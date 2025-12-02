'use server'

import { prisma } from '../lib/prisma'
import type { Prisma } from '@prisma/client'
import crypto from 'crypto'
import { checkAndUnlockAchievements } from '../lib/achievements'

type GameCategory = {
    id: string
    name: string
    questions: {
        id: string
        question: string
        answer: string
        value: number
        category: string
        difficulty: 'EASY' | 'MEDIUM' | 'HARD'
    }[]
}

export async function createNewGame(userId: string): Promise<{ gameId: string, categories: GameCategory[] }> {
    try {
        // Get user's spoiler settings
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                spoilerBlockDate: true,
                spoilerBlockEnabled: true
            }
        })

        // First get all categories with their question counts and respect spoiler settings
        const categoriesWithCounts = await prisma.category.findMany({
            where: {
                questions: {
                    some: user?.spoilerBlockEnabled ? {
                        airDate: {
                            lt: user.spoilerBlockDate ?? undefined
                        }
                    } : {}
                }
            },
            include: {
                _count: {
                    select: { 
                        questions: {
                            where: user?.spoilerBlockEnabled ? {
                                airDate: {
                                    lt: user.spoilerBlockDate ?? undefined
                                }
                            } : undefined
                        }
                    }
                }
            }
        })

        // Filter to categories with at least 5 questions
        const eligibleCategories = categoriesWithCounts.filter(
            category => category._count.questions >= 5
        )

        if (eligibleCategories.length < 5) {
            throw new Error('Not enough eligible categories')
        }

        // Randomly select 5 categories
        const selectedCategories = eligibleCategories
            .sort(() => Math.random() - 0.5)
            .slice(0, 5)

        // Create a new game
        const game = await prisma.game.create({
            data: {
                id: crypto.randomUUID(),
                userId,
                useKnowledgeCategories: false,
                score: 0,
                completed: false
            }
        })

        // Get questions for each category and create GameQuestion entries
        const categoriesWithQuestions = await Promise.all(
            selectedCategories.map(async (category) => {
                const questions = await prisma.question.findMany({
                    where: {
                        categoryId: category.id,
                        ...(user?.spoilerBlockEnabled ? {
                            airDate: {
                                lt: user.spoilerBlockDate ?? undefined
                            }
                        } : {})
                    },
                    orderBy: {
                        value: 'asc'
                    },
                    take: 5
                })

                // Create GameQuestion entries
                await prisma.gameQuestion.createMany({
                    data: questions.map(q => ({
                        id: crypto.randomUUID(),
                        gameId: game.id,
                        questionId: q.id,
                        answered: false
                    }))
                })

                return {
                    id: category.id,
                    name: category.name,
                    questions: questions.map(q => ({
                        id: q.id,
                        question: q.question,
                        answer: q.answer,
                        value: q.value,
                        category: category.name,
                        difficulty: q.difficulty
                    }))
                }
            })
        )

        return {
            gameId: game.id,
            categories: categoriesWithQuestions
        }
    } catch (error) {
        console.error('Error creating new game:', error)
        throw error
    }
}

export async function getCurrentGame(userId: string): Promise<{ gameId: string, categories: GameCategory[] } | null> {
    try {
        // Find the most recent incomplete game for the user
        const game = await prisma.game.findFirst({
            where: {
                userId,
                completed: false
            },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                questions: {
                    include: {
                        question: {
                            include: {
                                category: true
                            }
                        }
                    }
                }
            }
        })

        if (!game) return null

        // Group questions by category
        const categoriesMap = new Map<string, GameCategory>()

        game.questions.forEach(gq => {
            const category = gq.question.category
            if (!categoriesMap.has(category.id)) {
                categoriesMap.set(category.id, {
                    id: category.id,
                    name: category.name,
                    questions: []
                })
            }

            const categoryData = categoriesMap.get(category.id)!
            categoryData.questions.push({
                id: gq.question.id,
                question: gq.question.question,
                answer: gq.question.answer,
                value: gq.question.value,
                category: category.name,
                difficulty: gq.question.difficulty
            })
        })

        return {
            gameId: game.id,
            categories: Array.from(categoriesMap.values())
        }
    } catch (error) {
        console.error('Error fetching current game:', error)
        throw error
    }
}

export async function saveGameHistory(
    userId: string,
    questionId: string,
    isCorrect: boolean,
    points: number,
    gameId: string
): Promise<{ success: boolean }> {
    if (!userId || !questionId || !gameId) {
        return { success: false }
    }

    try {
        await prisma.$transaction(async (tx) => {
            // Update game question status
            await tx.gameQuestion.updateMany({
                where: {
                    gameId,
                    questionId
                },
                data: {
                    answered: true,
                    correct: isCorrect
                }
            })

            // Update game score
            if (isCorrect) {
                await tx.game.update({
                    where: { id: gameId },
                    data: {
                        score: { increment: points }
                    }
                })
            }

            // Create game history entry
            await tx.gameHistory.create({
                data: {
                    userId,
                    questionId,
                    correct: isCorrect,
                    points: isCorrect ? points : 0
                }
            })

            // Get the question to update user progress
            const question = await tx.question.findUnique({
                where: { id: questionId },
                include: { category: true }
            })

            if (!question) {
                throw new Error('Question not found')
            }

            // Update user progress
            await tx.userProgress.upsert({
                where: {
                    userId_categoryId: {
                        userId,
                        categoryId: question.categoryId
                    }
                },
                update: {
                    correct: { increment: isCorrect ? 1 : 0 },
                    total: { increment: 1 },
                    points: { increment: isCorrect ? points : 0 }
                },
                create: {
                    id: crypto.randomUUID(),
                    userId,
                    categoryId: question.categoryId,
                    questionId: question.id,
                    correct: isCorrect ? 1 : 0,
                    total: 1,
                    points: isCorrect ? points : 0
                }
            })
        })

        // Check for achievements asynchronously (don't block the response)
        // This allows real-time achievement tracking without slowing down gameplay
        checkAndUnlockAchievements(userId, {
            type: 'question_answered',
            data: {
                questionId,
                correct: isCorrect,
                gameId
            }
        }).catch(error => {
            console.error('Error checking achievements after question answer:', error)
        })

        return { success: true }
    } catch (error) {
        console.error('Error saving game history:', error)
        return { success: false }
    }
} 
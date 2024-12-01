'use server'

import { prisma } from '../lib/prisma'
import crypto from 'crypto'
import { PrismaClient, Prisma } from '@prisma/client'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

// Create a server-side Supabase client that includes auth context
async function getSupabase() {
    const cookieStore = cookies()
    return createServerComponentClient({ cookies: () => cookieStore })
}

export async function getCategories(userId?: string) {
    try {
        // Use Prisma for now until we fully set up Supabase
        const categories = await prisma.$queryRaw`
            SELECT 
                q."knowledgeCategory",
                COUNT(DISTINCT q.id) as total_questions,
                COUNT(DISTINCT CASE WHEN gh.correct = true AND gh."userId" = ${userId} THEN q.id END) as correct_questions
            FROM "Question" q
            LEFT JOIN "GameHistory" gh ON gh."questionId" = q.id AND gh."userId" = ${userId}
            GROUP BY q."knowledgeCategory"
        ` as Array<{ knowledgeCategory: string; total_questions: number; correct_questions: number }>

        return categories.map(cat => ({
            id: cat.knowledgeCategory,
            name: cat.knowledgeCategory.replace(/_/g, ' ').toLowerCase()
                .split(' ')
                .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' '),
            totalQuestions: Number(cat.total_questions),
            correctQuestions: Number(cat.correct_questions || 0)
        }))
    } catch (error) {
        console.error('Error fetching knowledge categories:', error)
        throw error
    }
}

export async function getKnowledgeCategoryDetails(knowledgeCategoryId: string, userId?: string) {
    try {
        // Get categories with their question counts and correct answers
        const categories = await prisma.category.findMany({
            where: {
                questions: {
                    some: {
                        knowledgeCategory: knowledgeCategoryId
                    }
                }
            },
            select: {
                id: true,
                name: true,
                questions: {
                    where: {
                        knowledgeCategory: knowledgeCategoryId
                    },
                    select: {
                        id: true,
                        gameHistory: userId ? {
                            where: {
                                userId,
                                correct: true
                            }
                        } : false
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        })

        return categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            totalQuestions: cat.questions.length,
            correctQuestions: userId ? cat.questions.filter(q => q.gameHistory?.length > 0).length : 0
        }))
    } catch (error) {
        console.error('Error fetching category details:', error)
        throw error
    }
}

export async function getRandomQuestion(knowledgeCategoryId?: string, categoryId?: string, userId?: string) {
    try {
        // Build the where clause based on provided filters
        const where: any = {}
        if (knowledgeCategoryId) where.knowledgeCategory = knowledgeCategoryId
        if (categoryId) where.categoryId = categoryId

        // Get total count for random selection
        const totalCount = await prisma.question.count({ where })
        if (totalCount === 0) return null

        // First try to get a random unanswered question
        const unansweredQuestion = await prisma.question.findFirst({
            where: {
                ...where,
                NOT: {
                    gameHistory: {
                        some: {
                            userId: userId
                        }
                    }
                }
            },
            include: {
                category: true
            },
            skip: Math.floor(Math.random() * totalCount)
        })

        // If no unanswered questions, get any random question
        const question = unansweredQuestion || await prisma.question.findFirst({
            where,
            include: {
                category: true,
                gameHistory: userId ? {
                    where: {
                        userId: userId
                    },
                    orderBy: {
                        timestamp: 'desc'
                    }
                } : false
            },
            skip: Math.floor(Math.random() * totalCount)
        })

        if (!question) return null

        const gameHistory = question.gameHistory || []
        const incorrectAttempts = userId && gameHistory.length > 0
            ? gameHistory
                .filter(h => !h.correct)
                .map(h => h.timestamp)
                .sort((a, b) => b.getTime() - a.getTime())
                .slice(0, 5)
            : []

        return {
            id: question.id,
            question: question.question,
            answer: question.answer,
            value: question.value || 200,
            categoryId: question.categoryId,
            categoryName: question.knowledgeCategory,
            originalCategory: question.category.name,
            airDate: question.airDate,
            answered: userId ? gameHistory.length > 0 : false,
            correct: userId ? gameHistory.some(h => h.correct) : false,
            incorrectAttempts
        }
    } catch (error) {
        console.error('Error fetching random question:', error)
        throw error
    }
}

export async function saveAnswer(
    userId: string,
    questionId: string,
    categoryId: string,
    isCorrect: boolean
) {
    if (!userId || !questionId || !categoryId) return

    try {
        await prisma.$transaction(async (tx) => {
            // First check if this question has been answered correctly before
            const existingHistory = await tx.gameHistory.findFirst({
                where: {
                    userId,
                    questionId,
                    correct: true
                }
            })

            // Only award points if this is the first correct answer
            const shouldAwardPoints = isCorrect && !existingHistory

            // Create game history entry
            await tx.gameHistory.create({
                data: {
                    userId,
                    questionId,
                    correct: isCorrect,
                    points: shouldAwardPoints ? 200 : 0
                }
            })

            // Update or create user progress
            await tx.userProgress.upsert({
                where: {
                    userId_categoryId: {
                        userId,
                        categoryId
                    }
                },
                update: {
                    correct: { increment: shouldAwardPoints ? 1 : 0 },
                    total: { increment: existingHistory ? 0 : 1 },
                    points: { increment: shouldAwardPoints ? 200 : 0 }
                },
                create: {
                    id: crypto.randomUUID(),
                    userId,
                    categoryId,
                    questionId,
                    correct: shouldAwardPoints ? 1 : 0,
                    total: 1,
                    points: shouldAwardPoints ? 200 : 0
                }
            })
        })

        return {
            success: true
        }
    } catch (error) {
        console.error('Error saving answer:', error)
        throw error
    }
}

export async function getCategoryQuestions(categoryId: string, knowledgeCategoryId: string, userId?: string) {
    try {
        const questions = await prisma.question.findMany({
            where: {
                categoryId,
                knowledgeCategory: knowledgeCategoryId
            },
            include: {
                category: true,
                gameHistory: userId ? {
                    where: {
                        userId: userId
                    },
                    orderBy: {
                        timestamp: 'desc'
                    }
                } : false
            }
        })

        return questions.map(question => {
            const gameHistory = question.gameHistory || []
            const incorrectAttempts = userId && gameHistory.length > 0
                ? gameHistory
                    .filter(h => !h.correct)
                    .map(h => h.timestamp)
                    .sort((a, b) => b.getTime() - a.getTime())
                    .slice(0, 5)
                : []

            return {
                id: question.id,
                question: question.question,
                answer: question.answer,
                value: question.value || 200,
                categoryId: question.categoryId,
                categoryName: question.knowledgeCategory,
                originalCategory: question.category.name,
                airDate: question.airDate,
                answered: userId ? gameHistory.length > 0 : false,
                correct: userId ? gameHistory.some(h => h.correct) : false,
                incorrectAttempts
            }
        })
    } catch (error) {
        console.error('Error fetching category questions:', error)
        throw error
    }
} 
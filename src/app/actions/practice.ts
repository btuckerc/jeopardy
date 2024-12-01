'use server'

import { prisma } from '../lib/prisma'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

type QuestionWithGameHistory = Prisma.QuestionGetPayload<{
    include: {
        category: true;
        gameHistory: true;
    }
}>

export async function getCategories(userId?: string) {
    try {
        // Get knowledge categories with their question counts
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

        return categories.map((cat: any) => ({
            id: cat.id,
            name: cat.name,
            totalQuestions: cat.questions.length,
            correctQuestions: userId ? cat.questions.filter((q: any) => q.gameHistory?.length > 0).length : 0
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
                        userId: userId,
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                } : false
            },
            skip: Math.floor(Math.random() * totalCount)
        })

        if (!question) return null

        // Get incorrect attempts
        const incorrectAttempts = userId && (question as QuestionWithGameHistory).gameHistory?.length > 0
            ? (question as QuestionWithGameHistory).gameHistory
                .filter(h => !h.correct)
                .map(h => h.createdAt)
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
            answered: userId ? (question as QuestionWithGameHistory).gameHistory?.length > 0 : false,
            correct: userId ? (question as QuestionWithGameHistory).gameHistory?.some(h => h.correct) : false,
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
        await prisma.$transaction(async (prismaClient: PrismaClient) => {
            // Ensure user exists
            const user = await prismaClient.user.upsert({
                where: { id: userId },
                update: {},
                create: {
                    id: userId,
                    email: '', // We'll update this later if needed
                }
            })

            // Get the question to get its category
            const question = await prismaClient.question.findUnique({
                where: { id: questionId },
                select: { categoryId: true }
            })

            if (!question) throw new Error('Question not found')

            // Create game history entry
            await prismaClient.gameHistory.create({
                data: {
                    userId: user.id,
                    questionId,
                    correct: isCorrect,
                    points: isCorrect ? 200 : 0 // Default value for practice mode
                }
            })

            // Update or create user progress
            await prismaClient.userProgress.upsert({
                where: {
                    userId_categoryId: {
                        userId: user.id,
                        categoryId: question.categoryId
                    }
                },
                update: {
                    correct: { increment: isCorrect ? 1 : 0 },
                    total: { increment: 1 },
                    points: { increment: isCorrect ? 200 : 0 }
                },
                create: {
                    id: crypto.randomUUID(),
                    userId: user.id,
                    categoryId: question.categoryId,
                    questionId,
                    correct: isCorrect ? 1 : 0,
                    total: 1,
                    points: isCorrect ? 200 : 0
                }
            })
        })
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
                        createdAt: 'desc'
                    }
                } : false
            }
        })

        return questions.map(question => {
            const incorrectAttempts = userId && (question as QuestionWithGameHistory).gameHistory?.length > 0
                ? (question as QuestionWithGameHistory).gameHistory
                    .filter(h => !h.correct)
                    .map(h => h.createdAt)
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
                answered: userId ? (question as QuestionWithGameHistory).gameHistory?.length > 0 : false,
                correct: userId ? (question as QuestionWithGameHistory).gameHistory?.some(h => h.correct) : false,
                incorrectAttempts
            }
        })
    } catch (error) {
        console.error('Error fetching category questions:', error)
        throw error
    }
} 
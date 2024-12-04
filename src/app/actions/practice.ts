'use server'

import { prisma } from '../lib/prisma'
import crypto from 'crypto'
import { PrismaClient, Prisma, KnowledgeCategory, Question, Category, GameHistory } from '@prisma/client'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

type GameHistoryWithTimestamp = {
    correct: boolean;
    timestamp: Date;
}

// Create a server-side Supabase client that includes auth context
async function getSupabase() {
    const cookieStore = cookies()
    return createServerComponentClient({ cookies: () => cookieStore })
}

export async function getCategories(userId?: string) {
    try {
        // Get total questions and correct questions per knowledge category
        const categories = await prisma.$queryRaw`
            WITH LatestCorrectAnswers AS (
                SELECT DISTINCT ON (gh."questionId")
                    gh."questionId",
                    gh.correct
                FROM "GameHistory" gh
                WHERE gh."userId" = ${userId}
                ORDER BY gh."questionId", gh.timestamp DESC
            )
            SELECT 
                q."knowledgeCategory",
                COUNT(DISTINCT q.id) as total_questions,
                COUNT(DISTINCT CASE 
                    WHEN lca.correct = true THEN q.id 
                    END) as correct_questions
            FROM "Question" q
            LEFT JOIN LatestCorrectAnswers lca ON lca."questionId" = q.id
            GROUP BY q."knowledgeCategory"
            ORDER BY q."knowledgeCategory"
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

export async function getKnowledgeCategoryDetails(
    knowledgeCategoryId: string,
    userId?: string,
    page: number = 1,
    pageSize: number = 20
) {
    try {
        // First, get total count for pagination
        const totalCount = await prisma.category.count({
            where: {
                questions: {
                    some: {
                        knowledgeCategory: knowledgeCategoryId as KnowledgeCategory
                    }
                }
            }
        });

        // Then get paginated categories with question counts
        const categories = await prisma.category.findMany({
            where: {
                questions: {
                    some: {
                        knowledgeCategory: knowledgeCategoryId as KnowledgeCategory
                    }
                }
            },
            include: {
                questions: {
                    where: {
                        knowledgeCategory: knowledgeCategoryId as KnowledgeCategory
                    },
                    orderBy: {
                        airDate: 'desc'
                    },
                    include: {
                        gameHistory: userId ? {
                            where: {
                                userId: userId
                            }
                        } : false
                    }
                }
            },
            skip: (page - 1) * pageSize,
            take: pageSize,
        });

        // Process categories with completion status
        const processedCategories = categories.map(cat => {
            const totalQuestions = cat.questions.length;
            const correctQuestions = userId ? cat.questions.filter(q =>
                q.gameHistory && Array.isArray(q.gameHistory) &&
                q.gameHistory.some(h => h.correct)
            ).length : 0;

            return {
                id: cat.id,
                name: cat.name,
                totalQuestions,
                correctQuestions,
                mostRecentAirDate: cat.questions.reduce((latest, q) =>
                    q.airDate && (!latest || q.airDate > latest) ? q.airDate : latest,
                    null as Date | null
                )
            };
        });

        // Sort by most recent air date
        const sortedCategories = processedCategories.sort((a, b) => {
            if (!a.mostRecentAirDate) return 1;
            if (!b.mostRecentAirDate) return -1;
            return b.mostRecentAirDate.getTime() - a.mostRecentAirDate.getTime();
        });

        return {
            categories: sortedCategories,
            totalPages: Math.ceil(totalCount / pageSize),
            currentPage: page,
            hasMore: page * pageSize < totalCount
        };
    } catch (error) {
        console.error('Error fetching category details:', error)
        throw error
    }
}

export async function getRandomQuestion(
    knowledgeCategoryId?: string,
    categoryId?: string,
    userId?: string,
    excludeQuestionId?: string
) {
    try {
        // Build the where clause based on provided filters
        const where: any = {}
        if (knowledgeCategoryId) where.knowledgeCategory = knowledgeCategoryId
        if (categoryId) where.categoryId = categoryId
        if (excludeQuestionId) where.NOT = { id: excludeQuestionId }

        // Get all eligible question IDs first
        const eligibleQuestions = await prisma.question.findMany({
            where: {
                ...where,
                NOT: {
                    gameHistory: userId ? {
                        some: {
                            userId: userId,
                            correct: true
                        }
                    } : undefined,
                    ...(excludeQuestionId ? { id: excludeQuestionId } : {})
                }
            },
            select: { id: true }
        })

        if (eligibleQuestions.length === 0) {
            // If no unanswered questions, get all questions except the excluded one
            const allQuestions = await prisma.question.findMany({
                where: {
                    ...where,
                    NOT: excludeQuestionId ? { id: excludeQuestionId } : undefined
                },
                select: { id: true }
            })

            if (allQuestions.length === 0) return null

            // Get a truly random question from the available ones
            const randomIndex = Math.floor(Math.random() * allQuestions.length)
            const randomId = allQuestions[randomIndex].id

            const question = await prisma.question.findUnique({
                where: { id: randomId },
                include: {
                    category: true,
                    gameHistory: userId ? {
                        where: { userId },
                        orderBy: { timestamp: 'desc' }
                    } : undefined
                }
            })

            if (!question) return null

            type QuestionWithRelations = Question & {
                category: Category;
                gameHistory?: GameHistory[];
            }

            const typedQuestion = question as QuestionWithRelations
            const gameHistory = typedQuestion.gameHistory || []
            const incorrectAttempts = userId && gameHistory.length > 0
                ? gameHistory
                    .filter((h: GameHistory) => !h.correct)
                    .map((h: GameHistory) => h.timestamp)
                    .sort((a: Date, b: Date) => b.getTime() - a.getTime())
                    .slice(0, 5)
                : []

            return {
                id: typedQuestion.id,
                question: typedQuestion.question,
                answer: typedQuestion.answer,
                value: typedQuestion.value || 200,
                categoryId: typedQuestion.categoryId,
                categoryName: typedQuestion.knowledgeCategory,
                originalCategory: typedQuestion.category.name,
                airDate: typedQuestion.airDate,
                answered: userId ? gameHistory.length > 0 : false,
                correct: userId ? gameHistory.some((h: GameHistory) => h.correct) : false,
                incorrectAttempts
            }
        }

        // Get a truly random question from the eligible ones
        const randomIndex = Math.floor(Math.random() * eligibleQuestions.length)
        const randomId = eligibleQuestions[randomIndex].id

        const question = await prisma.question.findUnique({
            where: { id: randomId },
            include: {
                category: true,
                gameHistory: userId ? {
                    where: { userId },
                    orderBy: { timestamp: 'desc' }
                } : undefined
            }
        })

        if (!question) return null

        type QuestionWithRelations = Question & {
            category: Category;
            gameHistory?: GameHistory[];
        }

        const typedQuestion = question as QuestionWithRelations
        const gameHistory = typedQuestion.gameHistory || []
        const incorrectAttempts = userId && gameHistory.length > 0
            ? gameHistory
                .filter((h: GameHistory) => !h.correct)
                .map((h: GameHistory) => h.timestamp)
                .sort((a: Date, b: Date) => b.getTime() - a.getTime())
                .slice(0, 5)
            : []

        return {
            id: typedQuestion.id,
            question: typedQuestion.question,
            answer: typedQuestion.answer,
            value: typedQuestion.value || 200,
            categoryId: typedQuestion.categoryId,
            categoryName: typedQuestion.knowledgeCategory,
            originalCategory: typedQuestion.category.name,
            airDate: typedQuestion.airDate,
            answered: userId ? gameHistory.length > 0 : false,
            correct: userId ? gameHistory.some((h: GameHistory) => h.correct) : false,
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

            // Get the question to determine its value
            const question = await tx.question.findUnique({
                where: { id: questionId },
                select: { value: true }
            })

            const questionValue = question?.value || 200

            // Only award points if this is the first correct answer
            const shouldAwardPoints = isCorrect && !existingHistory

            // Create game history entry
            await tx.gameHistory.create({
                data: {
                    userId,
                    questionId,
                    correct: isCorrect,
                    points: shouldAwardPoints ? questionValue : 0
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
                    points: { increment: shouldAwardPoints ? questionValue : 0 }
                },
                create: {
                    id: crypto.randomUUID(),
                    userId,
                    categoryId,
                    questionId,
                    correct: shouldAwardPoints ? 1 : 0,
                    total: 1,
                    points: shouldAwardPoints ? questionValue : 0
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
                knowledgeCategory: knowledgeCategoryId as KnowledgeCategory
            },
            orderBy: {
                airDate: 'desc'
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
            const gameHistory = (question.gameHistory || []) as GameHistoryWithTimestamp[]
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
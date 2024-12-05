'use server'

import { prisma } from '../lib/prisma'
import crypto from 'crypto'
import { PrismaClient, Prisma, KnowledgeCategory, Question, Category, GameHistory } from '@prisma/client'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

type GameHistoryWithTimestamp = {
    correct: boolean;
    timestamp: string | Date;
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
    pageSize: number = 20,
    searchQuery?: string
) {
    try {
        // Get categories with their questions and game history
        const result = await prisma.$queryRaw<Array<{
            id: string;
            name: string;
            totalQuestions: number;
            correctQuestions: number;
            mostRecentAirDate: Date | null;
            questions: Array<{
                id: string;
                airDate: Date | null;
                gameHistory: Array<{
                    timestamp: Date;
                    correct: boolean;
                }>;
            }>;
        }>>`
            WITH CategoryQuestions AS (
                SELECT 
                    c.id as category_id,
                    c.name as category_name,
                    q.id as question_id,
                    q."airDate",
                    COUNT(q.id) OVER (PARTITION BY c.id) as total_questions,
                    MAX(q."airDate") OVER (PARTITION BY c.id) as most_recent_air_date
                FROM "Category" c
                JOIN "Question" q ON q."categoryId" = c.id
                WHERE q."knowledgeCategory"::text = ${knowledgeCategoryId}
                ${searchQuery ? Prisma.sql`AND c.name ILIKE ${`%${searchQuery}%`}` : Prisma.empty}
            ),
            QuestionHistory AS (
                SELECT 
                    gh."questionId",
                    gh.timestamp,
                    gh.correct
                FROM "GameHistory" gh
                WHERE gh."userId" = ${userId}
                ORDER BY gh.timestamp DESC
            )
            SELECT 
                cq.category_id as id,
                cq.category_name as name,
                cq.total_questions::integer as "totalQuestions",
                COUNT(DISTINCT CASE WHEN qh.correct THEN cq.question_id END)::integer as "correctQuestions",
                cq.most_recent_air_date as "mostRecentAirDate",
                json_agg(json_build_object(
                    'id', cq.question_id,
                    'airDate', cq."airDate",
                    'gameHistory', (
                        SELECT json_agg(json_build_object(
                            'timestamp', qh.timestamp,
                            'correct', qh.correct
                        ))
                        FROM QuestionHistory qh
                        WHERE qh."questionId" = cq.question_id
                    )
                )) as questions
            FROM CategoryQuestions cq
            LEFT JOIN QuestionHistory qh ON qh."questionId" = cq.question_id
            GROUP BY cq.category_id, cq.category_name, cq.total_questions, cq.most_recent_air_date
            ORDER BY cq.most_recent_air_date DESC NULLS LAST
            OFFSET ${(page - 1) * pageSize}
            LIMIT ${pageSize}
        `;

        // Process the results to include attempt information
        const categories = result.map(category => ({
            id: category.id,
            name: category.name,
            totalQuestions: category.totalQuestions,
            correctQuestions: category.correctQuestions,
            mostRecentAirDate: category.mostRecentAirDate,
            questions: category.questions.map(q => ({
                id: q.id,
                airDate: q.airDate,
                gameHistory: q.gameHistory || [],
                incorrectAttempts: q.gameHistory
                    ?.filter(h => !h.correct)
                    ?.map(h => h.timestamp) || [],
                correct: q.gameHistory?.some(h => h.correct) || false,
                isLocked: q.gameHistory
                    ?.filter(h => !h.correct)
                    ?.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    ?.slice(0, 1)
                    ?.some(h => new Date().getTime() - new Date(h.timestamp).getTime() < 10 * 60 * 1000) || false,
                hasIncorrectAttempts: q.gameHistory?.some(h => !h.correct) || false
            }))
        }));

        const totalCount = await prisma.$queryRaw<[{ count: number }]>`
            SELECT COUNT(DISTINCT c.id)::integer as count
            FROM "Category" c
            JOIN "Question" q ON q."categoryId" = c.id
            WHERE q."knowledgeCategory"::text = ${knowledgeCategoryId}
            ${searchQuery ? Prisma.sql`AND c.name ILIKE ${`%${searchQuery}%`}` : Prisma.empty}
        `;

        const count = Number(totalCount[0].count);

        return {
            categories,
            totalPages: Math.ceil(count / pageSize),
            currentPage: page,
            hasMore: page * pageSize < count
        };
    } catch (error) {
        console.error('Error fetching knowledge category details:', error);
        throw error;
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
                    .sort((a: Date, b: Date) => new Date(b).getTime() - new Date(a).getTime())
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
                .sort((a: Date, b: Date) => new Date(b).getTime() - new Date(a).getTime())
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
        // Build the where clause based on whether we have a knowledge category or regular category
        const where: any = {
            categoryId
        };

        // Only add knowledge category filter if it's a valid knowledge category
        if (knowledgeCategoryId && Object.values(KnowledgeCategory).includes(knowledgeCategoryId as any)) {
            where.knowledgeCategory = knowledgeCategoryId as KnowledgeCategory;
        }

        const questions = await prisma.question.findMany({
            where,
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
        });

        return questions.map(question => {
            const gameHistory = (question.gameHistory || []) as GameHistoryWithTimestamp[]
            const incorrectAttempts = userId && gameHistory.length > 0
                ? gameHistory
                    .filter(h => !h.correct)
                    .map(h => h.timestamp)
                    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                    .slice(0, 5)
                : []

            const isLocked = incorrectAttempts.length > 0 &&
                new Date().getTime() - new Date(incorrectAttempts[0]).getTime() < 10 * 60 * 1000

            return {
                id: question.id,
                question: question.question,
                answer: question.answer,
                value: question.value || 200,
                categoryId: question.categoryId,
                categoryName: question.knowledgeCategory,
                originalCategory: question.category.name,
                airDate: question.airDate,
                gameHistory: gameHistory.map(h => ({
                    timestamp: h.timestamp,
                    correct: h.correct
                })),
                incorrectAttempts,
                answered: gameHistory.length > 0,
                correct: gameHistory.some(h => h.correct),
                isLocked,
                hasIncorrectAttempts: gameHistory.some(h => !h.correct)
            }
        })
    } catch (error) {
        console.error('Error fetching category questions:', error)
        throw error
    }
} 
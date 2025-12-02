'use server'

import { prisma } from '@/lib/prisma'
import { checkAndUnlockAchievements } from '@/lib/achievements'
import crypto from 'crypto'
import { Prisma, KnowledgeCategory, Question, Category, GameHistory } from '@prisma/client'
import { startOfDay } from 'date-fns'

type GameHistoryWithTimestamp = {
    correct: boolean;
    timestamp: string | Date;
}

// Helper to get user's spoiler settings
async function getUserSpoilerSettings(userId?: string) {
    if (!userId) return { enabled: false, date: null }
    
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            spoilerBlockEnabled: true,
            spoilerBlockDate: true
        }
    })
    
    return {
        enabled: user?.spoilerBlockEnabled ?? false,
        // If enabled but no date set, default to today
        date: user?.spoilerBlockEnabled 
            ? (user?.spoilerBlockDate ?? startOfDay(new Date()))
            : null
    }
}

export async function getCategories(userId?: string) {
    try {
        // Get user's spoiler settings
        const spoilerSettings = await getUserSpoilerSettings(userId)
        
        // Get total questions and correct questions per knowledge category
        // Respecting spoiler date filter
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
            WHERE (
                ${!spoilerSettings.enabled}::boolean = true 
                OR q."airDate" IS NULL 
                OR q."airDate" < ${spoilerSettings.date}::timestamp
            )
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
    searchQuery?: string,
    excludeRound?: 'FINAL',
    sortBy: 'airDate' | 'completion' = 'airDate'
) {
    try {
        // Get user's spoiler settings
        const spoilerSettings = await getUserSpoilerSettings(userId)
        
        // Build ORDER BY clause based on sortBy parameter
        const orderByClause = sortBy === 'completion' 
            ? Prisma.sql`ORDER BY (COUNT(DISTINCT CASE WHEN qh.correct THEN cq.question_id END)::float / NULLIF(cq.total_questions, 0)) DESC NULLS LAST, cq.most_recent_air_date DESC NULLS LAST`
            : Prisma.sql`ORDER BY cq.most_recent_air_date DESC NULLS LAST`;
        
        // Get categories with their questions and game history
        // Respecting spoiler date filter and excluding FINAL round if specified
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
                ${excludeRound === 'FINAL' ? Prisma.sql`AND q.round != 'FINAL'` : Prisma.empty}
                AND (
                    ${!spoilerSettings.enabled}::boolean = true 
                    OR q."airDate" IS NULL 
                    OR q."airDate" < ${spoilerSettings.date}::timestamp
                )
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
            ${orderByClause}
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
            ${excludeRound === 'FINAL' ? Prisma.sql`AND q.round != 'FINAL'` : Prisma.empty}
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
    excludeQuestionId?: string,
    round?: 'SINGLE' | 'DOUBLE' | 'FINAL'
) {
    try {
        // Get user's spoiler settings
        const spoilerSettings = await getUserSpoilerSettings(userId)
        
        // Build the where clause based on provided filters
        const where: any = {}
        if (knowledgeCategoryId) where.knowledgeCategory = knowledgeCategoryId
        if (categoryId) where.categoryId = categoryId
        if (round) where.round = round
        if (excludeQuestionId) where.NOT = { id: excludeQuestionId }
        
        // Apply spoiler date filter
        if (spoilerSettings.enabled && spoilerSettings.date) {
            where.OR = [
                { airDate: null },
                { airDate: { lt: spoilerSettings.date } }
            ]
        }

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
            // Still respecting spoiler settings
            const baseWhere: any = {}
            if (knowledgeCategoryId) baseWhere.knowledgeCategory = knowledgeCategoryId
            if (categoryId) baseWhere.categoryId = categoryId
            if (round) baseWhere.round = round
            if (spoilerSettings.enabled && spoilerSettings.date) {
                baseWhere.OR = [
                    { airDate: null },
                    { airDate: { lt: spoilerSettings.date } }
                ]
            }
            
            const allQuestions = await prisma.question.findMany({
                where: {
                    ...baseWhere,
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

        // Check for achievements asynchronously (don't block the response)
        // This allows real-time achievement tracking for study mode
        checkAndUnlockAchievements(userId, {
            type: 'question_answered',
            data: {
                questionId,
                correct: isCorrect
            }
        }).catch(error => {
            console.error('Error checking achievements after saving practice answer:', error)
        })

        return {
            success: true
        }
    } catch (error) {
        console.error('Error saving answer:', error)
        throw error
    }
}

export async function getCategoryQuestions(categoryId: string, knowledgeCategoryId: string, userId?: string, excludeRound?: 'FINAL', round?: 'SINGLE' | 'DOUBLE' | 'FINAL') {
    try {
        // Get user's spoiler settings
        const spoilerSettings = await getUserSpoilerSettings(userId)
        
        // Build the where clause based on whether we have a knowledge category or regular category
        const where: any = {
            categoryId
        };

        // Only add knowledge category filter if it's a valid knowledge category
        if (knowledgeCategoryId && Object.values(KnowledgeCategory).includes(knowledgeCategoryId as any)) {
            where.knowledgeCategory = knowledgeCategoryId as KnowledgeCategory;
        }
        
        // Filter by round if specified (takes precedence over excludeRound)
        if (round) {
            where.round = round
        } else if (excludeRound === 'FINAL') {
            // Exclude FINAL round if specified
            where.round = { not: 'FINAL' }
        }
        
        // Apply spoiler date filter
        if (spoilerSettings.enabled && spoilerSettings.date) {
            where.OR = [
                { airDate: null },
                { airDate: { lt: spoilerSettings.date } }
            ]
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

export async function getRoundCategories(
    round: 'SINGLE' | 'DOUBLE' | 'FINAL',
    userId?: string,
    page: number = 1,
    pageSize: number = 20,
    sortBy: 'airDate' | 'completion' = 'airDate'
) {
    try {
        // Get user's spoiler settings
        const spoilerSettings = await getUserSpoilerSettings(userId)
        
        // Build ORDER BY clause based on sortBy parameter
        const orderByClause = sortBy === 'completion' 
            ? Prisma.sql`ORDER BY (COUNT(DISTINCT CASE WHEN lca.correct THEN q.id END)::float / NULLIF(cq.total_questions, 0)) DESC NULLS LAST, cq.most_recent_air_date DESC NULLS LAST`
            : Prisma.sql`ORDER BY cq.most_recent_air_date DESC NULLS LAST`;
        
        // Get categories with their questions filtered by round
        const result = await prisma.$queryRaw<Array<{
            id: string;
            name: string;
            totalQuestions: number;
            correctQuestions: number;
            mostRecentAirDate: Date | null;
        }>>`
            WITH CategoryQuestions AS (
                SELECT 
                    c.id as category_id,
                    c.name as category_name,
                    COUNT(q.id) as total_questions,
                    MAX(q."airDate") as most_recent_air_date
                FROM "Category" c
                JOIN "Question" q ON q."categoryId" = c.id
                WHERE q.round = ${round}::"JeopardyRound"
                AND (
                    ${!spoilerSettings.enabled}::boolean = true 
                    OR q."airDate" IS NULL 
                    OR q."airDate" < ${spoilerSettings.date}::timestamp
                )
                GROUP BY c.id, c.name
            ),
            LatestCorrectAnswers AS (
                SELECT DISTINCT ON (gh."questionId")
                    gh."questionId",
                    gh.correct
                FROM "GameHistory" gh
                WHERE gh."userId" = ${userId}
                ORDER BY gh."questionId", gh.timestamp DESC
            )
            SELECT 
                cq.category_id as id,
                cq.category_name as name,
                cq.total_questions::integer as "totalQuestions",
                COUNT(DISTINCT CASE WHEN lca.correct THEN q.id END)::integer as "correctQuestions",
                cq.most_recent_air_date as "mostRecentAirDate"
            FROM CategoryQuestions cq
            JOIN "Question" q ON q."categoryId" = cq.category_id AND q.round = ${round}::"JeopardyRound"
            LEFT JOIN LatestCorrectAnswers lca ON lca."questionId" = q.id
            GROUP BY cq.category_id, cq.category_name, cq.total_questions, cq.most_recent_air_date
            ${orderByClause}
            OFFSET ${(page - 1) * pageSize}
            LIMIT ${pageSize}
        `;

        const categories = result.map(category => ({
            id: category.id,
            name: category.name,
            totalQuestions: category.totalQuestions,
            correctQuestions: category.correctQuestions,
            mostRecentAirDate: category.mostRecentAirDate,
            questions: []
        }));

        const totalCount = await prisma.$queryRaw<[{ count: number }]>`
            SELECT COUNT(DISTINCT c.id)::integer as count
            FROM "Category" c
            JOIN "Question" q ON q."categoryId" = c.id
            WHERE q.round = ${round}::"JeopardyRound"
            AND (
                ${!spoilerSettings.enabled}::boolean = true 
                OR q."airDate" IS NULL 
                OR q."airDate" < ${spoilerSettings.date}::timestamp
            )
        `;

        const count = Number(totalCount[0].count);

        return {
            categories,
            totalPages: Math.ceil(count / pageSize),
            currentPage: page,
            hasMore: page * pageSize < count
        };
    } catch (error) {
        console.error('Error fetching round categories:', error);
        throw error;
    }
}

export async function getTripleStumperQuestions(
    userId?: string,
    page: number = 1,
    pageSize: number = 20
) {
    try {
        // Get user's spoiler settings
        const spoilerSettings = await getUserSpoilerSettings(userId)
        
        // Build the where clause - if spoiler is enabled, combine with AND
        let whereClause: any
        
        if (spoilerSettings.enabled && spoilerSettings.date) {
            whereClause = {
                AND: [
                    { wasTripleStumper: true },
                    {
                        OR: [
                            { airDate: null },
                            { airDate: { lt: spoilerSettings.date } }
                        ]
                    }
                ]
            }
        } else {
            whereClause = { wasTripleStumper: true }
        }
        
        // Get triple stumper questions using Prisma's standard API for more reliability
        const questions = await prisma.question.findMany({
            where: whereClause,
            include: {
                category: true,
                gameHistory: userId ? {
                    where: { userId },
                    orderBy: { timestamp: 'desc' }
                } : false
            },
            orderBy: { airDate: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize
        })

        const transformedQuestions = questions.map(q => {
            const gameHistory = (q.gameHistory || []) as Array<{ timestamp: Date; correct: boolean }>
            const incorrectAttempts = gameHistory
                .filter(h => !h.correct)
                .map(h => h.timestamp)
                .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                .slice(0, 5)
            
            const isLocked = incorrectAttempts.length > 0 &&
                new Date().getTime() - new Date(incorrectAttempts[0]).getTime() < 10 * 60 * 1000

            return {
                id: q.id,
                question: q.question,
                answer: q.answer,
                value: q.value || 200,
                categoryId: q.categoryId,
                categoryName: q.category.name,
                originalCategory: q.category.name,
                airDate: q.airDate,
                round: q.round,
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

        const totalCount = await prisma.question.count({
            where: whereClause
        })

        return {
            questions: transformedQuestions,
            totalQuestions: totalCount,
            totalPages: Math.ceil(totalCount / pageSize),
            currentPage: page,
            hasMore: page * pageSize < totalCount
        };
    } catch (error) {
        console.error('Error fetching triple stumper questions:', error);
        throw error;
    }
}

export async function getTripleStumperCategories(
    userId?: string,
    page: number = 1,
    pageSize: number = 20,
    sortBy: 'airDate' | 'completion' = 'airDate'
) {
    try {
        // Get user's spoiler settings
        const spoilerSettings = await getUserSpoilerSettings(userId)
        
        // Build ORDER BY clause based on sortBy parameter
        const orderByClause = sortBy === 'completion' 
            ? Prisma.sql`ORDER BY (COUNT(DISTINCT CASE WHEN lca.correct THEN q.id END)::float / NULLIF(COUNT(q.id), 0)) DESC NULLS LAST, MAX(q."airDate") DESC NULLS LAST`
            : Prisma.sql`ORDER BY MAX(q."airDate") DESC NULLS LAST`;
        
        // Get categories that have triple stumper questions
        const result = await prisma.$queryRaw<Array<{
            id: string;
            name: string;
            totalQuestions: number;
            correctQuestions: number;
            mostRecentAirDate: Date | null;
        }>>`
            WITH LatestCorrectAnswers AS (
                SELECT DISTINCT ON (gh."questionId")
                    gh."questionId",
                    gh.correct
                FROM "GameHistory" gh
                WHERE gh."userId" = ${userId}
                ORDER BY gh."questionId", gh.timestamp DESC
            )
            SELECT 
                c.id,
                c.name,
                COUNT(q.id)::integer as "totalQuestions",
                COUNT(DISTINCT CASE WHEN lca.correct THEN q.id END)::integer as "correctQuestions",
                MAX(q."airDate") as "mostRecentAirDate"
            FROM "Category" c
            JOIN "Question" q ON q."categoryId" = c.id
            LEFT JOIN LatestCorrectAnswers lca ON lca."questionId" = q.id
            WHERE q."wasTripleStumper" = true
            AND (
                ${!spoilerSettings.enabled}::boolean = true 
                OR q."airDate" IS NULL 
                OR q."airDate" < ${spoilerSettings.date}::timestamp
            )
            GROUP BY c.id, c.name
            HAVING COUNT(q.id) > 0
            ${orderByClause}
            OFFSET ${(page - 1) * pageSize}
            LIMIT ${pageSize}
        `;

        const categories = result.map(category => ({
            id: category.id,
            name: category.name,
            totalQuestions: category.totalQuestions,
            correctQuestions: category.correctQuestions,
            mostRecentAirDate: category.mostRecentAirDate,
            questions: []
        }));

        const totalCount = await prisma.$queryRaw<[{ count: number }]>`
            SELECT COUNT(DISTINCT c.id)::integer as count
            FROM "Category" c
            JOIN "Question" q ON q."categoryId" = c.id
            WHERE q."wasTripleStumper" = true
            AND (
                ${!spoilerSettings.enabled}::boolean = true 
                OR q."airDate" IS NULL 
                OR q."airDate" < ${spoilerSettings.date}::timestamp
            )
        `;

        const count = Number(totalCount[0].count);

        return {
            categories,
            totalPages: Math.ceil(count / pageSize),
            currentPage: page,
            hasMore: page * pageSize < count
        };
    } catch (error) {
        console.error('Error fetching triple stumper categories:', error);
        throw error;
    }
}

export async function getTripleStumperCategoryQuestions(
    categoryId: string,
    userId?: string
) {
    try {
        // Get user's spoiler settings
        const spoilerSettings = await getUserSpoilerSettings(userId)
        
        const questions = await prisma.question.findMany({
            where: {
                categoryId,
                wasTripleStumper: true,
                ...(spoilerSettings.enabled && spoilerSettings.date ? {
                    OR: [
                        { airDate: null },
                        { airDate: { lt: spoilerSettings.date } }
                    ]
                } : {})
            },
            include: {
                category: true,
                gameHistory: userId ? {
                    where: { userId },
                    orderBy: { timestamp: 'desc' }
                } : false
            },
            orderBy: { value: 'asc' }
        })

        return questions.map(q => {
            const gameHistory = (q.gameHistory || []) as Array<{ timestamp: Date; correct: boolean }>
            const incorrectAttempts = gameHistory
                .filter(h => !h.correct)
                .map(h => h.timestamp)
                .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                .slice(0, 5)
            
            const isLocked = incorrectAttempts.length > 0 &&
                new Date().getTime() - new Date(incorrectAttempts[0]).getTime() < 10 * 60 * 1000

            return {
                id: q.id,
                question: q.question,
                answer: q.answer,
                value: q.value || 200,
                categoryId: q.categoryId,
                categoryName: q.category.name,
                originalCategory: q.category.name,
                airDate: q.airDate,
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
        console.error('Error fetching triple stumper category questions:', error)
        throw error
    }
}

export async function getRandomTripleStumper(
    userId?: string,
    excludeQuestionId?: string
) {
    try {
        // Get user's spoiler settings
        const spoilerSettings = await getUserSpoilerSettings(userId)
        
        // Build the where clause
        const where: any = {
            wasTripleStumper: true
        }
        
        if (excludeQuestionId) where.NOT = { id: excludeQuestionId }
        
        // Apply spoiler date filter
        if (spoilerSettings.enabled && spoilerSettings.date) {
            where.OR = [
                { airDate: null },
                { airDate: { lt: spoilerSettings.date } }
            ]
        }

        // Get all eligible question IDs first (unanswered triple stumpers)
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
            // If no unanswered questions, get all triple stumper questions except the excluded one
            const allQuestions = await prisma.question.findMany({
                where: {
                    wasTripleStumper: true,
                    NOT: excludeQuestionId ? { id: excludeQuestionId } : undefined,
                    ...(spoilerSettings.enabled && spoilerSettings.date ? {
                        OR: [
                            { airDate: null },
                            { airDate: { lt: spoilerSettings.date } }
                        ]
                    } : {})
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

            const gameHistory = question.gameHistory || []
            const incorrectAttempts = userId && gameHistory.length > 0
                ? gameHistory
                    .filter((h: GameHistory) => !h.correct)
                    .map((h: GameHistory) => h.timestamp)
                    .sort((a: Date, b: Date) => new Date(b).getTime() - new Date(a).getTime())
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

        const gameHistory = question.gameHistory || []
        const incorrectAttempts = userId && gameHistory.length > 0
            ? gameHistory
                .filter((h: GameHistory) => !h.correct)
                .map((h: GameHistory) => h.timestamp)
                .sort((a: Date, b: Date) => new Date(b).getTime() - new Date(a).getTime())
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
            correct: userId ? gameHistory.some((h: GameHistory) => h.correct) : false,
            incorrectAttempts
        }
    } catch (error) {
        console.error('Error fetching random triple stumper:', error)
        throw error
    }
} 
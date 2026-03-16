import { z } from 'zod'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
    jsonResponse,
    getAuthenticatedUser,
    unauthorizedResponse,
    serverErrorResponse,
    parseSearchParams
} from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { buildStudyRecommendations, CategoryStudySnapshot } from '@/lib/study-scheduler'

export const dynamic = 'force-dynamic'

const recommendationsQuerySchema = z.object({
    maxRecommendations: z.string().optional().transform(value => {
        if (!value) return 5
        const parsed = parseInt(value, 10)
        if (Number.isNaN(parsed)) return 5
        return Math.max(1, Math.min(parsed, 10))
    }),
    maxSessionSize: z.string().optional().transform(value => {
        if (!value) return 3
        const parsed = parseInt(value, 10)
        if (Number.isNaN(parsed)) return 3
        return Math.max(1, Math.min(parsed, 6))
    })
})

type RecommendationRow = {
    categoryId: string
    categoryName: string
    total: number
    correct: number
}

type LastAttemptRow = {
    categoryId: string
    last_attempted_at: Date | null
}

/**
 * GET /api/stats/recommendations
 * Returns adaptive study recommendations for signed-in users
 */
export const GET = withInstrumentation(async (request: NextRequest) => {
    try {
        const appUser = await getAuthenticatedUser()
        if (!appUser) {
            return unauthorizedResponse('Sign in to get personalized recommendations')
        }

        const { searchParams } = new URL(request.url)
        const paramsResult = parseSearchParams(searchParams, recommendationsQuerySchema)
        if (paramsResult.error) {
            return paramsResult.error
        }

        const { maxRecommendations, maxSessionSize } = paramsResult.data

        const rawCategoryProgress = await prisma.userProgress.findMany({
            where: { userId: appUser.id },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                    }
                }
            }
        })

        if (rawCategoryProgress.length === 0) {
            return jsonResponse({
                recommendations: [],
                quickSession: {
                    categories: [],
                    summary: 'Start practicing to unlock personalized recommendations',
                },
                focusNow: null,
                totalAttemptedCategories: 0,
            })
        }

        const categoryRows = rawCategoryProgress.map((progress): RecommendationRow => ({
            categoryId: progress.categoryId,
            categoryName: progress.category.name,
            total: Number(progress.total),
            correct: Number(progress.correct),
        }))

        const categoryIds = categoryRows.map(row => row.categoryId)
        const lastAttempts = await prisma.$queryRaw<LastAttemptRow[]>`
            SELECT
                q."categoryId"::text as "categoryId",
                MAX(gh."timestamp")::timestamp as "last_attempted_at"
            FROM "GameHistory" gh
            JOIN "Question" q ON q.id = gh."questionId"
            WHERE gh."userId" = ${appUser.id}
                AND q."categoryId" = ANY(${categoryIds})
            GROUP BY q."categoryId"
        `

        const lastAttemptByCategory = new Map<string, Date | null>()
        for (const row of lastAttempts) {
            lastAttemptByCategory.set(row.categoryId, row.last_attempted_at ? new Date(row.last_attempted_at) : null)
        }

        const snapshots = categoryRows.map(row => ({
            categoryId: row.categoryId,
            categoryName: row.categoryName,
            totalQuestions: row.total,
            correctAnswers: row.correct,
            lastAttemptedAt: lastAttemptByCategory.get(row.categoryId) || null,
        }))

        const recommendations = buildStudyRecommendations(
            snapshots as CategoryStudySnapshot[],
            {
                now: new Date(),
                maxRecommendations,
                maxSessionSize,
            }
        )

        return jsonResponse(recommendations)
    } catch (error: unknown) {
        return serverErrorResponse('Failed to build study recommendations', error)
    }
})

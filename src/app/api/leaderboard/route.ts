import { z } from 'zod'
import {
    jsonResponse,
    serverErrorResponse,
    requireAuth,
    parseSearchParams
} from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { NextRequest } from 'next/server'
import { LeaderboardScope, getLeaderboardEntries } from '@/lib/leaderboard'

export const dynamic = 'force-dynamic'

// Cache leaderboard for 5 minutes
export const revalidate = 300

// Request validation schema
const leaderboardParamsSchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(100),
    scope: z.enum(['global', 'friends']).optional().default('global')
})

export const GET = withInstrumentation(async (request: NextRequest) => {
    // Require authentication
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    try {
        const { searchParams } = new URL(request.url)
        const { data: params, error } = parseSearchParams(searchParams, leaderboardParamsSchema)
        if (error) return error

        const scope = params.scope as LeaderboardScope
        const userStats = await getLeaderboardEntries({
            limit: params.limit,
            scope,
            viewerUserId: scope === 'friends' ? user.id : undefined,
        })

        return jsonResponse({
            leaderboard: userStats,
            updatedAt: new Date().toISOString()
        })
    } catch (error) {
        return serverErrorResponse('Failed to fetch leaderboard', error)
    }
})

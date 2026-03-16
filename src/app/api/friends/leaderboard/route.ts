import { z } from 'zod'
import { NextRequest } from 'next/server'
import { getLeaderboardEntries } from '@/lib/leaderboard'
import { jsonResponse, parseSearchParams, requireAuth, serverErrorResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'

const friendsLeaderboardSchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(100),
})

export const GET = withInstrumentation(async (request: NextRequest) => {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const parsed = parseSearchParams(searchParams, friendsLeaderboardSchema)
    if (parsed.error) return parsed.error

    try {
        const leaderboard = await getLeaderboardEntries({
            limit: parsed.data.limit,
            scope: 'friends',
            viewerUserId: user.id,
        })

        return jsonResponse({
            scope: 'friends',
            viewerUserId: user.id,
            leaderboard,
        })
    } catch (error) {
        return serverErrorResponse('Error loading friends leaderboard', error)
    }
})

export const dynamic = 'force-dynamic'

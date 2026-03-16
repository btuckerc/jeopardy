import { z } from 'zod'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequestResponse, jsonResponse, parseSearchParams, requireAuth, serverErrorResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { isFriend } from '@/lib/friends'

const compareSchema = z.object({
    friendId: z.string().min(1, 'friendId is required'),
})

export const GET = withInstrumentation(async (request: NextRequest) => {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const parsed = parseSearchParams(searchParams, compareSchema)
    if (parsed.error) return parsed.error

    try {
        const friendId = parsed.data.friendId

        if (!(await isFriend(user.id, friendId))) {
            return badRequestResponse('You can only compare streaks with friends')
        }

        const [viewer, friend] = await Promise.all([
            prisma.user.findUnique({
                where: { id: user.id },
                select: {
                    id: true,
                    displayName: true,
                    selectedIcon: true,
                    avatarBackground: true,
                    currentStreak: true,
                    longestStreak: true,
                },
            }),
            prisma.user.findUnique({
                where: { id: friendId },
                select: {
                    id: true,
                    displayName: true,
                    selectedIcon: true,
                    avatarBackground: true,
                    currentStreak: true,
                    longestStreak: true,
                },
            }),
        ])

        if (!viewer || !friend) {
            return badRequestResponse('Users not found')
        }

        return jsonResponse({
            viewer,
            friend,
            comparison: {
                currentStreakDelta: viewer.currentStreak - friend.currentStreak,
                longestStreakDelta: viewer.longestStreak - friend.longestStreak,
            },
        })
    } catch (error) {
        return serverErrorResponse('Error comparing streaks', error)
    }
})

export const dynamic = 'force-dynamic'

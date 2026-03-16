import { z } from 'zod'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequestResponse, jsonResponse, parseSearchParams, requireAuth, serverErrorResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { listFriendIds } from '@/lib/friends'
import { getBlockedUserIdsForUser } from '@/lib/friends'
import { FriendActivityType } from '@prisma/client'

const FRIEND_ACTIVITY_TYPES = Object.values(FriendActivityType) as string[]
const FRIEND_ACTIVITY_TYPE_SET = new Set(FRIEND_ACTIVITY_TYPES)

const friendActivitySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    activityType: z.union([z.string(), z.array(z.string())]).optional(),
})

export const GET = withInstrumentation(async (request: NextRequest) => {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const parsed = parseSearchParams(searchParams, friendActivitySchema)
    if (parsed.error) return parsed.error
    const { limit } = parsed.data

    const rawActivityTypeFilters = parsed.data.activityType
        ? Array.isArray(parsed.data.activityType)
            ? parsed.data.activityType
            : [parsed.data.activityType]
        : []
    const parsedActivityTypes = rawActivityTypeFilters
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter((value) => value.length > 0)

    const activityTypeSet = new Set(
        parsedActivityTypes.map((value) => value.toUpperCase()).filter((value) => FRIEND_ACTIVITY_TYPE_SET.has(value)),
    )
    const validActivityTypes = [...activityTypeSet] as FriendActivityType[]
    const invalidActivityTypes = parsedActivityTypes.filter(
        (value) => !FRIEND_ACTIVITY_TYPE_SET.has(value.trim().toUpperCase()),
    )

    if (invalidActivityTypes.length > 0) {
        return badRequestResponse(`Invalid activityType filter: ${invalidActivityTypes.join(', ')}`)
    }

    try {
        const friendIds = await listFriendIds(user.id)
        const blockedUserIds = await getBlockedUserIdsForUser(user.id)
        const visibleUserIds = [user.id, ...friendIds]

        const activities = await prisma.friendActivity.findMany({
            where: {
                OR: [
                    { actorUserId: user.id },
                    { relatedUserId: user.id },
                    {
                        AND: [
                            { actorUserId: { in: visibleUserIds } },
                            { relatedUserId: { in: visibleUserIds } },
                        ],
                    },
                ],
                ...(validActivityTypes.length > 0 ? { activityType: { in: validActivityTypes } } : {}),
                ...(blockedUserIds.length > 0 ? {
                    AND: [
                        { actorUserId: { notIn: blockedUserIds } },
                        { relatedUserId: { notIn: blockedUserIds } },
                    ],
                } : {}),
            },
            include: {
                actorUser: {
                    select: {
                        id: true,
                        displayName: true,
                        selectedIcon: true,
                        avatarBackground: true,
                    },
                },
                relatedUser: {
                    select: {
                        id: true,
                        displayName: true,
                        selectedIcon: true,
                        avatarBackground: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        })

        return jsonResponse({
            activities,
        })
    } catch (error) {
        return serverErrorResponse('Error loading friend activities', error)
    }
})

export const dynamic = 'force-dynamic'

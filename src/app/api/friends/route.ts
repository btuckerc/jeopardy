import { NextRequest } from 'next/server'
import { FriendRequestStatus } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { jsonResponse, parseSearchParams, requireAuth, serverErrorResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import {
    getFriendRequestsForUser,
    getFriendsForUser,
    getBlockedUsersForUser,
    getBlockedUserIdsForUser,
    getFriendSettings,
} from '@/lib/friends'

const friendListSchema = z.object({
    includeHistory: z.coerce.boolean().default(false),
    status: z
        .enum(['pending', 'all'])
        .default('pending'),
})

export const GET = withInstrumentation(async (request: NextRequest) => {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const parsed = parseSearchParams(searchParams, friendListSchema)
    if (parsed.error) return parsed.error
    const { includeHistory, status } = parsed.data

    const requestedStatuses =
        status === 'all'
            ? [
                  FriendRequestStatus.PENDING,
                  FriendRequestStatus.ACCEPTED,
                  FriendRequestStatus.DECLINED,
                  FriendRequestStatus.CANCELLED,
              ]
            : [FriendRequestStatus.PENDING]

    try {
        const [friends, blockedUserIds, blockedUsers, settings] = await Promise.all([
            getFriendsForUser(user.id),
            getBlockedUserIdsForUser(user.id),
            getBlockedUsersForUser(user.id),
            getFriendSettings(user.id),
        ])

        const friendIds = friends.map((friend) => friend.id)
        if (friendIds.length > 0) {
            // Self-heal stale rows from earlier races: pending request + existing friendship.
            await prisma.friendRequest.updateMany({
                where: {
                    status: FriendRequestStatus.PENDING,
                    OR: [
                        {
                            fromUserId: user.id,
                            toUserId: { in: friendIds },
                        },
                        {
                            toUserId: user.id,
                            fromUserId: { in: friendIds },
                        },
                    ],
                },
                data: {
                    status: FriendRequestStatus.ACCEPTED,
                    respondedAt: new Date(),
                },
            })
        }

        const allRequests = await getFriendRequestsForUser(user.id, requestedStatuses)

        const friendIdSet = new Set(friends.map((friend) => friend.id))
        const filteredRequests = allRequests.filter(
            (request) =>
                !blockedUserIds.includes(request.fromUserId)
                && !blockedUserIds.includes(request.toUserId),
        )
        const visibleRequests = filteredRequests.filter((request) => {
            const counterpartUserId = request.fromUserId === user.id
                ? request.toUserId
                : request.fromUserId
            return !friendIdSet.has(counterpartUserId)
        })

        const incoming = visibleRequests
            .filter((request) => request.toUserId === user.id)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        const outgoing = visibleRequests
            .filter((request) => request.fromUserId === user.id)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

        const requestedIncoming = includeHistory || status === 'pending' ? incoming : incoming.slice(0, 20)
        const requestedOutgoing = includeHistory || status === 'pending' ? outgoing : outgoing.slice(0, 20)

        return jsonResponse({
            friends,
            incomingRequests: requestedIncoming,
            outgoingRequests: requestedOutgoing,
            settings,
            blockedUsers,
            requestedStatuses,
            counts: {
                friends: friends.length,
                incoming: requestedIncoming.length,
                outgoing: requestedOutgoing.length,
            },
            isHistoryEnabled: includeHistory,
        })
    } catch (error) {
        return serverErrorResponse('Error loading friend data', error)
    }
})

export const dynamic = 'force-dynamic'

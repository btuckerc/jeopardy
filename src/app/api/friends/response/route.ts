import { z } from 'zod'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { FriendActivityType, FriendRequestStatus } from '@prisma/client'
import {
    badRequestResponse,
    jsonResponse,
    parseBody,
    requireAuth,
    serverErrorResponse
} from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { canonicalFriendPair } from '@/lib/friends'
import { hasBlockedRelationship } from '@/lib/friends'

const friendResponseSchema = z.object({
    requestId: z.string().min(1),
    action: z.enum(['accept', 'decline', 'cancel']),
})

export const POST = withInstrumentation(async (request: NextRequest) => {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const parsed = await parseBody(request, friendResponseSchema)
    if (parsed.error) return parsed.error

    const { requestId, action } = parsed.data

    try {
        const requestRecord = await prisma.friendRequest.findUnique({
            where: { id: requestId },
        })

        if (!requestRecord) {
            return badRequestResponse('Friend request not found')
        }

        if (requestRecord.fromUserId === requestRecord.toUserId) {
            return badRequestResponse('Invalid friend request')
        }

        if (action === 'cancel') {
            if (requestRecord.fromUserId !== user.id) {
                return badRequestResponse('Only the requester can cancel this request')
            }

            if (requestRecord.status === FriendRequestStatus.CANCELLED) {
                return jsonResponse({
                    request: {
                        ...requestRecord,
                        response: 'cancelled',
                    },
                })
            }

            if (requestRecord.status !== FriendRequestStatus.PENDING) {
                return badRequestResponse(`Cannot ${action} a request with status ${requestRecord.status}`)
            }

            const updated = await prisma.friendRequest.update({
                where: { id: requestRecord.id },
                data: {
                    status: FriendRequestStatus.CANCELLED,
                    respondedAt: new Date(),
                },
            })

            await prisma.friendActivity.create({
                data: {
                    actorUserId: user.id,
                    relatedUserId: requestRecord.toUserId,
                    activityType: FriendActivityType.FRIEND_REQUEST_CANCELLED,
                    metadata: { requestId: requestRecord.id },
                },
            })

            return jsonResponse({
                request: {
                    ...updated,
                    response: 'cancelled',
                },
            })
        }

        if (requestRecord.toUserId !== user.id) {
            return badRequestResponse('Only the recipient can respond to this request')
        }

        if (action === 'accept' && requestRecord.status === FriendRequestStatus.ACCEPTED) {
            return jsonResponse({
                request: {
                    ...requestRecord,
                    response: 'accepted',
                },
            })
        }

        if (requestRecord.status !== FriendRequestStatus.PENDING) {
            return badRequestResponse(`Cannot ${action} a request with status ${requestRecord.status}`)
        }

        if (await hasBlockedRelationship(requestRecord.fromUserId, requestRecord.toUserId)) {
            return badRequestResponse('This request can no longer be updated')
        }

        if (action === 'decline') {
            const updated = await prisma.friendRequest.update({
                where: { id: requestRecord.id },
                data: {
                    status: FriendRequestStatus.DECLINED,
                    respondedAt: new Date(),
                },
            })

            await prisma.friendActivity.create({
                data: {
                    actorUserId: user.id,
                    relatedUserId: requestRecord.fromUserId,
                    activityType: FriendActivityType.FRIEND_REQUEST_DECLINED,
                    metadata: { requestId: requestRecord.id },
                },
            })

            return jsonResponse({
                request: {
                    ...updated,
                    response: 'declined',
                },
            })
        }

        const accepted = await prisma.$transaction(async (tx) => {
            const [userId1, userId2] = canonicalFriendPair(requestRecord.fromUserId, requestRecord.toUserId)
            const currentlyPending = await tx.friendRequest.findFirst({
                where: { id: requestRecord.id, status: FriendRequestStatus.PENDING },
            })

            if (!currentlyPending) {
                const latestRequest = await tx.friendRequest.findUnique({
                    where: { id: requestRecord.id },
                })

                if (latestRequest?.status === FriendRequestStatus.ACCEPTED) {
                    return latestRequest
                }

                throw new Error('Request no longer pending')
            }

            const friendRequestUpdated = await tx.friendRequest.update({
                where: { id: requestRecord.id },
                data: {
                    status: FriendRequestStatus.ACCEPTED,
                    respondedAt: new Date(),
                },
            })

            const existingFriendship = await tx.friendship.findFirst({
                where: {
                    userId1,
                    userId2,
                },
            })

            if (!existingFriendship) {
                await tx.friendship.create({
                    data: { userId1, userId2 },
                })
            }

            // If duplicate cross-requests were created, normalize all pending requests between
            // this pair so no stale "pending" row remains visible.
            await tx.friendRequest.updateMany({
                where: {
                    id: { not: requestRecord.id },
                    status: FriendRequestStatus.PENDING,
                    OR: [
                        { fromUserId: requestRecord.fromUserId, toUserId: requestRecord.toUserId },
                        { fromUserId: requestRecord.toUserId, toUserId: requestRecord.fromUserId },
                    ],
                },
                data: {
                    status: FriendRequestStatus.ACCEPTED,
                    respondedAt: new Date(),
                },
            })

            await tx.friendActivity.create({
                data: {
                    actorUserId: user.id,
                    relatedUserId: requestRecord.fromUserId,
                    activityType: FriendActivityType.FRIEND_REQUEST_ACCEPTED,
                    metadata: { requestId: requestRecord.id },
                },
            })

            return friendRequestUpdated
        })

        return jsonResponse({
            request: {
                ...accepted,
                response: 'accepted',
            },
        })
    } catch (error) {
        if (error instanceof Error && error.message === 'Request no longer pending') {
            return badRequestResponse('This request is no longer pending')
        }
        return serverErrorResponse('Error updating friend request', error)
    }
})

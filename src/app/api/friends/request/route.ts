import { z } from 'zod'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { FriendActivityType, FriendRequestStatus, Prisma } from '@prisma/client'
import {
    badRequestResponse,
    jsonResponse,
    parseBody,
    requireAuth,
    serverErrorResponse
} from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import {
    findFriendTarget,
    getFriendshipBetweenUsers,
    getRequestBetweenUsers,
    hasBlockedRelationship,
} from '@/lib/friends'
import { isFriendCodeCandidate, normalizeFriendCode } from '@/lib/friend-invite'

const friendRequestSchema = z.object({
    target: z.string().trim().min(1, 'Target is required').max(320, 'Target is too long'),
    message: z.string().trim().max(500, 'Message is too long').optional().nullable().transform((value) => value || undefined),
})

export const POST = withInstrumentation(async (request: NextRequest) => {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const parseResult = await parseBody(request, friendRequestSchema)
    if (parseResult.error) return parseResult.error
    const { target, message } = parseResult.data

    try {
        const targetUser = await findFriendTarget(target, { allowUserIdLookup: true })
        if (!targetUser) {
            return badRequestResponse(
                isFriendCodeCandidate(normalizeFriendCode(target))
                    ? 'Friend code not found'
                    : 'User not found',
            )
        }

        if (targetUser.id === user.id) {
            return badRequestResponse('You cannot send a friend request to yourself')
        }

        if (!targetUser.allowFriendRequests) {
            return badRequestResponse('This user is not accepting friend requests')
        }

        if (await hasBlockedRelationship(user.id, targetUser.id)) {
            return badRequestResponse('Unable to send a friend request to this user')
        }

        const existingFriendship = await getFriendshipBetweenUsers(user.id, targetUser.id)
        if (existingFriendship) {
            return badRequestResponse('These users are already friends')
        }

        const existingRequest = await getRequestBetweenUsers(user.id, targetUser.id, {
            status: [FriendRequestStatus.PENDING]
        })
        if (existingRequest) {
            return badRequestResponse(
                existingRequest.fromUserId === user.id
                    ? 'You already sent a pending request to this user'
                    : 'This user has already sent you a pending request'
            )
        }

        const requestRecord = await prisma.$transaction(async (tx) => {
            const created = await tx.friendRequest.create({
                data: {
                    fromUserId: user.id,
                    toUserId: targetUser.id,
                    message: message || null,
                    status: FriendRequestStatus.PENDING,
                },
            })

            await tx.friendActivity.create({
                data: {
                    actorUserId: user.id,
                    relatedUserId: targetUser.id,
                    activityType: FriendActivityType.FRIEND_REQUEST_SENT,
                    metadata: {
                        requestId: created.id,
                        target: targetUser.displayName || targetUser.email,
                        message: message || null,
                    },
                },
            })

            return created
        })

        return jsonResponse({
            request: {
                id: requestRecord.id,
                status: requestRecord.status,
                fromUserId: requestRecord.fromUserId,
                toUserId: requestRecord.toUserId,
                createdAt: requestRecord.createdAt,
                target: targetUser,
            },
        })
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError
            && error.code === 'P2002'
        ) {
            return badRequestResponse('A pending friend request already exists between these users')
        }
        return serverErrorResponse('Error sending friend request', error)
    }
})

export const dynamic = 'force-dynamic'

import { z } from 'zod'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequestResponse, jsonResponse, parseBody, requireAuth, serverErrorResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import {
    clearFriendshipAndRequests,
    getBlockedUserIdsForUser,
    getBlockedUsersForUser,
} from '@/lib/friends'

const friendBlockSchema = z.object({
    blockedUserId: z.string().trim().min(1, 'blockedUserId is required'),
    action: z.enum(['block', 'unblock']),
})

export const GET = withInstrumentation(async () => {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    try {
        const blockedUsers = await getBlockedUsersForUser(user.id)
        return jsonResponse({
            blockedUsers,
        })
    } catch (error) {
        return serverErrorResponse('Error loading blocked users', error)
    }
})

export const POST = withInstrumentation(async (request: NextRequest) => {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const parsed = await parseBody(request, friendBlockSchema)
    if (parsed.error) return parsed.error
    const { blockedUserId, action } = parsed.data

    if (blockedUserId === user.id) {
        return badRequestResponse('You cannot block yourself')
    }

    try {
        if (action === 'block') {
            const blockedUser = await prisma.user.findUnique({
                where: { id: blockedUserId },
                select: { id: true },
            })

            if (!blockedUser) {
                return badRequestResponse('User not found')
            }

            await clearFriendshipAndRequests(user.id, blockedUserId)
            await prisma.friendBlock.upsert({
                where: {
                    blockerUserId_blockedUserId: {
                        blockerUserId: user.id,
                        blockedUserId,
                    },
                },
                create: {
                    blockerUserId: user.id,
                    blockedUserId,
                },
                update: {},
            })
        } else {
            await prisma.friendBlock.deleteMany({
                where: {
                    blockerUserId: user.id,
                    blockedUserId,
                },
            })
        }

        const blockedUsers = await getBlockedUsersForUser(user.id)
        const blockedUserIds = await getBlockedUserIdsForUser(user.id)

        return jsonResponse({
            blockedUsers,
            blockedUserIds,
        })
    } catch (error) {
        return serverErrorResponse('Error updating blocked users', error)
    }
})

export const dynamic = 'force-dynamic'

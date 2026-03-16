import { z } from 'zod'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
    badRequestResponse,
    jsonResponse,
    parseBody,
    requireAuth,
    serverErrorResponse,
} from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { getFriendshipBetweenUsers } from '@/lib/friends'

const friendRemoveSchema = z.object({
    friendId: z.string().trim().min(1, 'friendId is required'),
})

export const POST = withInstrumentation(async (request: NextRequest) => {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const parsed = await parseBody(request, friendRemoveSchema)
    if (parsed.error) return parsed.error

    const { friendId } = parsed.data

    if (friendId === user.id) {
        return badRequestResponse('You cannot remove yourself')
    }

    try {
        const friendship = await getFriendshipBetweenUsers(user.id, friendId)

        if (!friendship) {
            return badRequestResponse('These users are not friends')
        }

        await prisma.$transaction([
            prisma.friendship.delete({
                where: { id: friendship.id },
            }),
            prisma.friendRequest.deleteMany({
                where: {
                    OR: [
                        { fromUserId: user.id, toUserId: friendId },
                        { fromUserId: friendId, toUserId: user.id },
                    ],
                },
            }),
        ])

        return jsonResponse({
            success: true,
            friendshipId: friendship.id,
        })
    } catch (error) {
        return serverErrorResponse('Error removing friend', error)
    }
})

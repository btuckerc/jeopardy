import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api-utils'

async function getSocialCursor(userId: string): Promise<number> {
    const [latestRequest, latestChallenge, latestActivity, latestFriendship, latestBlock, latestProfile] = await Promise.all([
        prisma.friendRequest.findFirst({
            where: {
                OR: [
                    { fromUserId: userId },
                    { toUserId: userId },
                ],
            },
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true },
        }),
        prisma.friendChallenge.findFirst({
            where: {
                OR: [
                    { challengerUserId: userId },
                    { opponentUserId: userId },
                ],
            },
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true },
        }),
        prisma.friendActivity.findFirst({
            where: {
                OR: [
                    { actorUserId: userId },
                    { relatedUserId: userId },
                ],
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        }),
        prisma.friendship.findFirst({
            where: {
                OR: [
                    { userId1: userId },
                    { userId2: userId },
                ],
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        }),
        prisma.friendBlock.findFirst({
            where: {
                OR: [
                    { blockerUserId: userId },
                    { blockedUserId: userId },
                ],
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        }),
        prisma.user.findUnique({
            where: { id: userId },
            select: {
                updatedAt: true,
                friendInviteTokenCreatedAt: true,
            },
        }),
    ])

    return Math.max(
        latestRequest?.updatedAt.getTime() ?? 0,
        latestChallenge?.updatedAt.getTime() ?? 0,
        latestActivity?.createdAt.getTime() ?? 0,
        latestFriendship?.createdAt.getTime() ?? 0,
        latestBlock?.createdAt.getTime() ?? 0,
        latestProfile?.updatedAt.getTime() ?? 0,
        latestProfile?.friendInviteTokenCreatedAt?.getTime() ?? 0,
    )
}

export async function GET(request: NextRequest) {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const encoder = new TextEncoder()
    const initialCursor = await getSocialCursor(user.id)

    const stream = new ReadableStream({
        start(controller) {
            let closed = false
            let lastCursor = initialCursor

            const sendEvent = (event: string, payload: Record<string, unknown>) => {
                controller.enqueue(
                    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
                )
            }

            sendEvent('connected', { cursor: lastCursor })

            const intervalId = setInterval(async () => {
                if (closed) {
                    return
                }

                try {
                    const nextCursor = await getSocialCursor(user.id)
                    if (nextCursor !== lastCursor) {
                        lastCursor = nextCursor
                        sendEvent('social_update', { cursor: nextCursor })
                        return
                    }

                    controller.enqueue(encoder.encode(': heartbeat\n\n'))
                } catch (error) {
                    console.error('Friend events stream failed:', error)
                    closed = true
                    clearInterval(intervalId)
                    controller.close()
                }
            }, 2000)

            request.signal.addEventListener('abort', () => {
                if (closed) {
                    return
                }

                closed = true
                clearInterval(intervalId)
                controller.close()
            })
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
        },
    })
}

export const dynamic = 'force-dynamic'

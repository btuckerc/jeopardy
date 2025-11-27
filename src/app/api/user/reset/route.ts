import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils'

export async function POST() {
    const session = await auth()

    if (!session?.user?.id) {
        return unauthorizedResponse()
    }

    try {
        // Delete all user game data in a transaction
        await prisma.$transaction([
            prisma.gameQuestion.deleteMany({
                where: { game: { userId: session.user.id } }
            }),
            prisma.game.deleteMany({
                where: { userId: session.user.id }
            }),
            prisma.gameHistory.deleteMany({
                where: { userId: session.user.id }
            }),
            prisma.userProgress.deleteMany({
                where: { userId: session.user.id }
            })
        ])

        return jsonResponse({ success: true })
    } catch (error) {
        return serverErrorResponse('Failed to reset user data', error)
    }
}

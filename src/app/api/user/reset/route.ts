import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils'

export async function POST() {
    const appUser = await getAppUser()

    if (!appUser) {
        return unauthorizedResponse()
    }

    try {
        // Delete all user game data in a transaction
        await prisma.$transaction([
            prisma.gameQuestion.deleteMany({
                where: { game: { userId: appUser.id } }
            }),
            prisma.game.deleteMany({
                where: { userId: appUser.id }
            }),
            prisma.gameHistory.deleteMany({
                where: { userId: appUser.id }
            }),
            prisma.userProgress.deleteMany({
                where: { userId: appUser.id }
            })
        ])

        return jsonResponse({ success: true })
    } catch (error) {
        return serverErrorResponse('Failed to reset user data', error)
    }
}

import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils'

export async function GET() {
    const appUser = await getAppUser()

    if (!appUser) {
        return unauthorizedResponse()
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: appUser.id },
            select: {
                spoilerBlockDate: true,
                spoilerBlockEnabled: true,
                lastSpoilerPrompt: true
            }
        })

        return jsonResponse({
            spoilerBlockDate: user?.spoilerBlockDate,
            spoilerBlockEnabled: user?.spoilerBlockEnabled ?? false,
            lastSpoilerPrompt: user?.lastSpoilerPrompt
        })
    } catch (error) {
        return serverErrorResponse('Error fetching spoiler settings', error)
    }
}

export async function POST(request: Request) {
    const appUser = await getAppUser()

    if (!appUser) {
        return unauthorizedResponse()
    }

    try {
        const body = await request.json()
        const { spoilerBlockDate, spoilerBlockEnabled, lastSpoilerPrompt } = body

        const settings = await prisma.user.update({
            where: { id: appUser.id },
            data: {
                spoilerBlockEnabled: spoilerBlockEnabled ?? undefined,
                spoilerBlockDate: spoilerBlockDate ? new Date(spoilerBlockDate) : null,
                lastSpoilerPrompt: lastSpoilerPrompt ? new Date(lastSpoilerPrompt) : null
            },
            select: {
                spoilerBlockDate: true,
                spoilerBlockEnabled: true,
                lastSpoilerPrompt: true
            }
        })

        return jsonResponse(settings)
    } catch (error) {
        return serverErrorResponse('Error updating spoiler settings', error)
    }
}

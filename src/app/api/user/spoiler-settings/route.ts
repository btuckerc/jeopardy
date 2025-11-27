import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils'

export async function GET() {
    const session = await auth()

    if (!session?.user?.id) {
        return unauthorizedResponse()
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
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
    const session = await auth()

    if (!session?.user?.id) {
        return unauthorizedResponse()
    }

    try {
        const body = await request.json()
        const { spoilerBlockDate, spoilerBlockEnabled, lastSpoilerPrompt } = body

        const settings = await prisma.user.update({
            where: { id: session.user.id },
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

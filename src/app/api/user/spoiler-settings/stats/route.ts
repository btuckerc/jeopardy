import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const appUser = await getAppUser()

    if (!appUser) {
        return unauthorizedResponse()
    }

    try {
        const { searchParams } = new URL(request.url)
        const dateParam = searchParams.get('date')
        
        if (!dateParam) {
            return jsonResponse({ error: 'Date parameter required' }, 400)
        }

        // Spoiler settings only apply to LEGACY_JEOPARDY episodes (original packs are spoiler-free)
        const totalQuestions = await prisma.question.count({
            where: { source: 'ORIGINAL_ENGINE', publishStatus: 'PUBLISHED' }
        })

        return jsonResponse({
            totalQuestions,
            availableQuestions: totalQuestions,
            blockedQuestions: 0
        })
    } catch (error) {
        return serverErrorResponse('Error fetching spoiler stats', error)
    }
}


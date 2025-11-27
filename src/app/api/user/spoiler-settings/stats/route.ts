import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const session = await auth()

    if (!session?.user?.id) {
        return unauthorizedResponse()
    }

    try {
        const { searchParams } = new URL(request.url)
        const dateParam = searchParams.get('date')
        
        if (!dateParam) {
            return jsonResponse({ error: 'Date parameter required' }, 400)
        }

        const blockDate = new Date(dateParam)
        
        // Get total questions count
        const totalQuestions = await prisma.question.count()
        
        // Get available questions (before the block date or with null air date)
        const availableQuestions = await prisma.question.count({
            where: {
                OR: [
                    { airDate: null },
                    { airDate: { lt: blockDate } }
                ]
            }
        })
        
        const blockedQuestions = totalQuestions - availableQuestions

        return jsonResponse({
            totalQuestions,
            availableQuestions,
            blockedQuestions
        })
    } catch (error) {
        return serverErrorResponse('Error fetching spoiler stats', error)
    }
}


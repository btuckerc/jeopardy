import { prisma } from '@/lib/prisma'
import { jsonResponse, serverErrorResponse, parseSearchParams } from '@/lib/api-utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Request validation schema
const guestQuestionParamsSchema = z.object({
    excludeId: z.string().uuid().optional()
})

/**
 * GET /api/practice/guest-question
 * Get a random question for guest users (no auth required)
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const { data: params, error } = parseSearchParams(searchParams, guestQuestionParamsSchema)
        
        if (error) return error

        // Build where clause - exclude FINAL round for simplicity, and exclude the excluded ID if provided
        const where: Record<string, unknown> = {
            round: { not: 'FINAL' }
        }
        
        if (params.excludeId) {
            where.id = { not: params.excludeId }
        }

        // Get count for random selection
        const count = await prisma.question.count({ where })
        
        if (count === 0) {
            return jsonResponse({ error: 'No questions found' }, 404)
        }

        // Get a random question using skip
        const skip = Math.floor(Math.random() * count)
        const questions = await prisma.question.findMany({
            where,
            skip,
            take: 1,
            include: {
                category: true
            }
        })

        if (!questions.length) {
            return jsonResponse({ error: 'No questions found' }, 404)
        }

        const question = questions[0]

        return jsonResponse({
            id: question.id,
            question: question.question,
            answer: question.answer,
            value: question.value,
            category: question.knowledgeCategory,
            originalCategory: question.category.name,
            knowledgeCategory: question.knowledgeCategory
        })
    } catch (error) {
        return serverErrorResponse('Error fetching guest question', error)
    }
}


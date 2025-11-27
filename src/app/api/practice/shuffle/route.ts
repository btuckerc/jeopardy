import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { 
    jsonResponse, 
    notFoundResponse, 
    serverErrorResponse,
    parseSearchParams,
    knowledgeCategorySchema 
} from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

// Request validation schema
const shuffleParamsSchema = z.object({
    category: knowledgeCategorySchema.optional(),
    excludeId: z.string().uuid().optional(),
    round: z.enum(['SINGLE', 'DOUBLE', 'FINAL']).optional()
})

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const { data: params, error } = parseSearchParams(searchParams, shuffleParamsSchema)
        
        if (error) return error

        // Build where clause
        const where: Record<string, unknown> = {}
        
        if (params.category) {
            where.knowledgeCategory = params.category
        }
        
        if (params.round) {
            where.round = params.round
        }
        
        if (params.excludeId) {
            where.id = { not: params.excludeId }
        }

        // Get count for random selection (more efficient than fetching all)
        const count = await prisma.question.count({ where })
        
        if (count === 0) {
            return notFoundResponse('No questions found')
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
            return notFoundResponse('No questions found')
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
        return serverErrorResponse('Error shuffling questions', error)
    }
} 
import { prisma } from '@/lib/prisma'
import { jsonResponse, serverErrorResponse } from '@/lib/api-utils'
import { getPlayableQuestionWhere } from '@/lib/question-policy'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const playableWhere = getPlayableQuestionWhere('ORIGINAL_ENGINE')

        // Get all ORIGINAL_ENGINE categories with their published question counts
        const categories = await prisma.category.findMany({
            where: {
                source: 'ORIGINAL_ENGINE',
                questions: {
                    some: playableWhere
                }
            },
            include: {
                _count: {
                    select: {
                        questions: {
                            where: playableWhere
                        }
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        })

        return jsonResponse(categories)
    } catch (error) {
        return serverErrorResponse('Failed to fetch categories', error)
    }
} 
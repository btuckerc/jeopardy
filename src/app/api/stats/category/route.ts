import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, badRequestResponse, unauthorizedResponse, notFoundResponse, serverErrorResponse } from '@/lib/api-utils'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const categoryName = searchParams.get('name')
    const categoryId = searchParams.get('id')

    if (!categoryName && !categoryId) {
        return badRequestResponse('Category name or id is required')
    }

    try {
        const appUser = await getAppUser()

        if (!appUser) {
            return unauthorizedResponse()
        }

        // Load matching category rows (by exact id, or across both ORIGINAL_ENGINE & LEGACY_JEOPARDY for name
        // so historical legacy answers on colliding category names remain visible!)
        const matchedCategories = await prisma.category.findMany({
            where: categoryId ? { id: categoryId } : { name: categoryName! },
            orderBy: { source: 'desc' },
            include: {
                questions: {
                    orderBy: {
                        value: 'asc'
                    },
                    include: {
                        gameHistory: {
                            where: {
                                userId: appUser.id,
                                correct: true
                            },
                            orderBy: { timestamp: 'desc' },
                            take: 1
                        }
                    }
                }
            }
        })

        if (matchedCategories.length === 0) {
            return notFoundResponse('Category not found')
        }

        // Include all ORIGINAL_ENGINE published questions plus any LEGACY_JEOPARDY questions the user actually answered
        const mergedQuestions = matchedCategories.flatMap(cat =>
            cat.questions.filter(q =>
                (q.source === 'ORIGINAL_ENGINE' && q.publishStatus === 'PUBLISHED') ||
                q.gameHistory.length > 0
            )
        )

        const questions = mergedQuestions.map(question => {
            const isCorrect = question.gameHistory.length > 0
            return {
                id: question.id,
                question: isCorrect ? question.question : null,
                answer: isCorrect ? question.answer : null,
                value: question.value,
                airDate: question.airDate,
                correct: isCorrect
            }
        })

        return jsonResponse({
            questions,
            totalQuestions: mergedQuestions.length,
            correctQuestions: questions.filter(q => q.correct).length
        })
    } catch (error) {
        return serverErrorResponse('Failed to fetch category details', error)
    }
} 
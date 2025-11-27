import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { jsonResponse, badRequestResponse, unauthorizedResponse, notFoundResponse, serverErrorResponse } from '@/lib/api-utils'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const categoryName = searchParams.get('name')

    if (!categoryName) {
        return badRequestResponse('Category name is required')
    }

    try {
        const session = await auth()

        if (!session?.user?.id) {
            return unauthorizedResponse()
        }

        const category = await prisma.category.findUnique({
            where: { name: categoryName },
            include: {
                questions: {
                    orderBy: {
                        value: 'asc'
                    },
                    include: {
                        gameHistory: {
                            where: {
                                userId: session.user.id,
                                correct: true
                            },
                            orderBy: { timestamp: 'desc' },
                            take: 1
                        }
                    }
                }
            }
        })

        if (!category) {
            return notFoundResponse('Category not found')
        }

        const questions = category.questions.map(question => {
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
            totalQuestions: category.questions.length,
            correctQuestions: questions.filter(q => q.correct).length
        })
    } catch (error) {
        return serverErrorResponse('Failed to fetch category details', error)
    }
} 
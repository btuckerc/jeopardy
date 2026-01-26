import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, notFoundResponse, serverErrorResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'

export const dynamic = 'force-dynamic'

async function getHandler(request: NextRequest, context?: { params?: Record<string, string | string[]> }) {
    try {
        const appUser = await getAppUser()
        if (!appUser) {
            return unauthorizedResponse()
        }

        const questionId = context?.params?.questionId as string
        if (!questionId) {
            return jsonResponse({ error: 'Missing questionId parameter' }, 400)
        }

        const question = await prisma.question.findUnique({
            where: { id: questionId },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        })

        if (!question) {
            return notFoundResponse('Question not found')
        }

        return jsonResponse({
            id: question.id,
            question: question.question,
            answer: question.answer,
            value: question.value,
            category: question.category
        })
    } catch (error) {
        console.error('Error fetching question:', error)
        return serverErrorResponse('Failed to fetch question', error)
    }
}

export const GET = withInstrumentation(getHandler)

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, notFoundResponse, forbiddenResponse, serverErrorResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'

export const dynamic = 'force-dynamic'

async function getHandler(request: NextRequest, context?: { params?: Record<string, string | string[]> }) {
    try {
        const appUser = await getAppUser()
        if (!appUser) {
            return unauthorizedResponse()
        }

        const questionId = context?.params?.questionId as string
        const revealAnswers = new URL(request.url).searchParams.get('reveal') === 'true'
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

        const isAdmin = appUser.role === 'ADMIN'
        if (question.source !== 'ORIGINAL_ENGINE' || question.publishStatus !== 'PUBLISHED') {
            if (!isAdmin) {
                // Allow non-admin access to a legacy question ONLY if the user has existing history/game/daily participation
                const [hasGameQuestion, hasHistory, hasDaily] = await Promise.all([
                    prisma.gameQuestion.findFirst({
                        where: {
                            questionId: question.id,
                            game: { OR: [{ userId: appUser.id }, { opponentUserId: appUser.id }] }
                        },
                        select: { id: true }
                    }),
                    prisma.gameHistory.findFirst({
                        where: { userId: appUser.id, questionId: question.id },
                        select: { id: true }
                    }),
                    prisma.userDailyChallenge.findFirst({
                        where: { userId: appUser.id, challenge: { questionId: question.id } },
                        select: { id: true }
                    })
                ])

                if (!hasGameQuestion && !hasHistory && !hasDaily) {
                    return forbiddenResponse('Question is not available in the public question pool')
                }
            }
        }

        return jsonResponse({
            id: question.id,
            question: question.question,
            answer: revealAnswers ? question.answer : null,
            value: question.value,
            source: question.source,
            category: question.category
        })
    } catch (error) {
        console.error('Error fetching question:', error)
        return serverErrorResponse('Failed to fetch question', error)
    }
}

export const GET = withInstrumentation(getHandler)

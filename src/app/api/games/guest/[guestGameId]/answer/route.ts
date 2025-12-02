import { prisma } from '@/lib/prisma'
import { jsonResponse, serverErrorResponse, parseBody, notFoundResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { checkGuestLimit, getGuestConfig } from '@/lib/guest-sessions'
import { checkAnswer } from '@/app/lib/answer-checker'

export const dynamic = 'force-dynamic'

const answerSchema = z.object({
    questionId: z.string().uuid(),
    answer: z.string().min(1)
})

interface RouteParams {
    params: Promise<{ guestGameId: string }>
}

/**
 * POST /api/games/guest/[guestGameId]/answer
 * Submit an answer for a guest game question
 */
export async function POST(request: Request, { params }: RouteParams) {
    try {
        const { guestGameId } = await params
        
        const { data: body, error } = await parseBody(request, answerSchema)
        if (error) return error

        // Get guest game with session
        const guestGame = await prisma.guestGame.findUnique({
            where: { id: guestGameId },
            include: {
                guestSession: true,
                questions: {
                    include: {
                        question: true
                    }
                }
            }
        })

        if (!guestGame) {
            return notFoundResponse('Guest game not found')
        }

        // Check if session is expired or claimed
        if (new Date() > guestGame.guestSession.expiresAt || guestGame.guestSession.claimedAt) {
            return jsonResponse({
                error: 'Guest session expired or already claimed',
                requiresAuth: true
            }, 403)
        }

        // Get question
        const question = await prisma.question.findUnique({
            where: { id: body.questionId }
        })

        if (!question) {
            return notFoundResponse('Question not found')
        }

        // Check if question already answered
        const existingAnswer = guestGame.questions.find(
            q => q.questionId === body.questionId && q.answered
        )

        if (existingAnswer) {
            return jsonResponse({
                correct: existingAnswer.correct,
                alreadyAnswered: true,
                currentScore: guestGame.currentScore
            })
        }

        // Check guest limits before allowing answer
        const answeredQuestions = guestGame.questions.filter(q => q.answered)
        const answeredCount = answeredQuestions.length
        
        // Count unique categories and rounds from answered questions
        const categorySet = new Set<string>()
        const roundSet = new Set<string>()
        
        for (const answeredQ of answeredQuestions) {
            if (answeredQ.question) {
                // Get category name
                const category = await prisma.category.findUnique({
                    where: { id: answeredQ.question.categoryId }
                })
                if (category) {
                    categorySet.add(category.name)
                }
                // Track round
                if (answeredQ.question.round) {
                    roundSet.add(answeredQ.question.round)
                }
            }
        }
        
        // Add current question's category and round
        const currentCategory = await prisma.category.findUnique({
            where: { id: question.categoryId }
        })
        if (currentCategory) {
            categorySet.add(currentCategory.name)
        }
        if (question.round) {
            roundSet.add(question.round)
        }
        
        const limitCheck = await checkGuestLimit(
            'RANDOM_GAME',
            answeredCount + 1,
            categorySet.size,
            roundSet.size
        )
        
        if (!limitCheck.allowed) {
            return jsonResponse({
                error: limitCheck.reason || 'Guest limit reached',
                requiresAuth: true,
                limitReached: true
            }, 403)
        }

        // Check answer
        const correct = checkAnswer(body.answer, question.answer)
        const points = correct ? (question.value || 0) : -(question.value || 0)
        const newScore = guestGame.currentScore + points

        // Update guest game question
        await prisma.guestGameQuestion.upsert({
            where: {
                guestGameId_questionId: {
                    guestGameId,
                    questionId: body.questionId
                }
            },
            create: {
                guestGameId,
                questionId: body.questionId,
                answered: true,
                correct
            },
            update: {
                answered: true,
                correct
            }
        })

        // Update guest game score
        await prisma.guestGame.update({
            where: { id: guestGameId },
            data: {
                currentScore: newScore,
                updatedAt: new Date()
            }
        })

        // Check if limit reached after this answer
        const newAnsweredCount = answeredCount + 1
        const config = await getGuestConfig()
        const limitReached = newAnsweredCount >= config.randomGameMaxQuestionsBeforeAuth

        return jsonResponse({
            correct,
            answer: question.answer,
            points,
            currentScore: newScore,
            limitReached,
            requiresAuth: limitReached
        })
    } catch (error) {
        return serverErrorResponse('Error submitting guest game answer', error)
    }
}


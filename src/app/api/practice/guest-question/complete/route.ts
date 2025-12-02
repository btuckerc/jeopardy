import { prisma } from '@/lib/prisma'
import { jsonResponse, serverErrorResponse, parseBody } from '@/lib/api-utils'
import { z } from 'zod'
import { createGuestSession, checkGuestLimit } from '@/lib/guest-sessions'

export const dynamic = 'force-dynamic'

const completeQuestionSchema = z.object({
    guestSessionId: z.string().uuid().optional(),
    questionId: z.string().uuid(),
    correct: z.boolean(),
    points: z.number(),
    rawAnswer: z.string().optional()
})

/**
 * POST /api/practice/guest-question/complete
 * Record a completed guest question and create/update guest session
 */
export async function POST(request: Request) {
    try {
        const { data: body, error } = await parseBody(request, completeQuestionSchema)
        
        if (error) return error
        
        const { guestSessionId, questionId, correct, points, rawAnswer } = body
        
        // If we have an existing session, check if it's valid and if limit is reached
        let sessionId: string | undefined = guestSessionId
        let expiresAt: Date
        let currentQuestionCount = 0
        
        if (sessionId) {
            // Check existing session
            const session = await prisma.guestSession.findUnique({
                where: { id: sessionId }
            })
            
            if (!session || new Date() > session.expiresAt || session.claimedAt) {
                // Session expired or claimed, treat as new session
                sessionId = undefined
                currentQuestionCount = 0
            } else {
                // Session exists and is valid - this means they've already answered 1 question
                currentQuestionCount = 1
            }
        }
        
        // Check guest limits based on current count
        const limitCheck = await checkGuestLimit('RANDOM_QUESTION', currentQuestionCount)
        if (!limitCheck.allowed) {
            return jsonResponse({
                error: limitCheck.reason || 'Guest limit reached',
                requiresAuth: true
            }, 403)
        }
        
        // Get question details for category information (needed for redirect after claim)
        const questionDetails = await prisma.question.findUnique({
            where: { id: questionId },
            include: { category: true }
        })
        
        // Create or update session
        if (sessionId) {
            // Update existing session with category info
            await prisma.guestSession.update({
                where: { id: sessionId },
                data: {
                    data: {
                        questionId,
                        correct,
                        points,
                        userAnswer: rawAnswer,
                        timestamp: new Date().toISOString(),
                        categoryName: questionDetails?.category.name,
                        knowledgeCategory: questionDetails?.knowledgeCategory
                    }
                }
            })
            const session = await prisma.guestSession.findUnique({
                where: { id: sessionId }
            })
            expiresAt = session!.expiresAt
        } else {
            // Create new session with category info for redirect
            const newSession = await createGuestSession('RANDOM_QUESTION', {
                questionId,
                correct,
                points,
                userAnswer: rawAnswer,
                timestamp: new Date().toISOString(),
                categoryName: questionDetails?.category.name,
                knowledgeCategory: questionDetails?.knowledgeCategory
            })
            sessionId = newSession.id
            expiresAt = newSession.expiresAt
        }
        
        // Check if limit is reached after this submission (they've now answered 1 question)
        const postSubmissionLimitCheck = await checkGuestLimit('RANDOM_QUESTION', 1)
        const limitReached = !postSubmissionLimitCheck.allowed
        
        return jsonResponse({
            guestSessionId: sessionId,
            expiresAt: expiresAt.toISOString(),
            limitReached
        })
    } catch (error) {
        return serverErrorResponse('Error completing guest question', error)
    }
}


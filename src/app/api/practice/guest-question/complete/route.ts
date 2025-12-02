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
        
        // If we have an existing session, check if it's valid and count questions
        let sessionId: string | undefined = guestSessionId
        let expiresAt: Date
        let currentQuestionCount = 0
        let categorySet = new Set<string>()
        
        if (sessionId) {
            // Check existing session
            const session = await prisma.guestSession.findUnique({
                where: { id: sessionId }
            })
            
            if (!session || new Date() > session.expiresAt || session.claimedAt) {
                // Session expired or claimed, treat as new session
                sessionId = undefined
                currentQuestionCount = 0
                categorySet = new Set()
            } else {
                // Session exists and is valid - extract question count and categories from session data
                const sessionData = session.data as {
                    questionId?: string
                    questionCount?: number
                    categories?: string[]
                    [key: string]: unknown
                } | null
                
                if (sessionData) {
                    // If questionCount is stored, use it; otherwise assume 1 (backward compatibility)
                    currentQuestionCount = sessionData.questionCount ?? 1
                    if (sessionData.categories && Array.isArray(sessionData.categories)) {
                        categorySet = new Set(sessionData.categories)
                    } else if (sessionData.categoryName) {
                        categorySet.add(sessionData.categoryName as string)
                    }
                } else {
                    // No data means this is a new question
                    currentQuestionCount = 0
                }
            }
        }
        
        // Get question details for category information (needed for redirect after claim)
        const questionDetails = await prisma.question.findUnique({
            where: { id: questionId },
            include: { category: true }
        })
        
        // Add current question's category to the set
        if (questionDetails?.category.name) {
            categorySet.add(questionDetails.category.name)
        }
        
        // Check guest limits based on current count
        const limitCheck = await checkGuestLimit(
            'RANDOM_QUESTION',
            currentQuestionCount,
            categorySet.size
        )
        if (!limitCheck.allowed) {
            return jsonResponse({
                error: limitCheck.reason || 'Guest limit reached',
                requiresAuth: true
            }, 403)
        }
        
        // Increment question count for this submission
        const newQuestionCount = currentQuestionCount + 1
        
        // Create or update session
        if (sessionId) {
            // Update existing session with latest question info and updated counts
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
                        knowledgeCategory: questionDetails?.knowledgeCategory,
                        questionCount: newQuestionCount,
                        categories: Array.from(categorySet)
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
                knowledgeCategory: questionDetails?.knowledgeCategory,
                questionCount: newQuestionCount,
                categories: Array.from(categorySet)
            })
            sessionId = newSession.id
            expiresAt = newSession.expiresAt
        }
        
        // Check if limit is reached after this submission
        const postSubmissionLimitCheck = await checkGuestLimit(
            'RANDOM_QUESTION',
            newQuestionCount,
            categorySet.size
        )
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


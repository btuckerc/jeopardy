import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, badRequestResponse, serverErrorResponse, parseBody } from '@/lib/api-utils'
import { z } from 'zod'

const createDisputeSchema = z.object({
    questionId: z.string().uuid(),
    gameId: z.string().uuid().optional(),
    mode: z.enum(['GAME', 'PRACTICE']),
    round: z.enum(['SINGLE', 'DOUBLE', 'FINAL']),
    userAnswer: z.string().min(1),
    systemWasCorrect: z.boolean()
})

export const dynamic = 'force-dynamic'

/**
 * POST /api/answers/disputes
 * Create a new dispute for an answer that was marked incorrect
 */
export async function POST(request: NextRequest) {
    try {
        const appUser = await getAppUser()
        if (!appUser) {
            return unauthorizedResponse()
        }

        const { data: body, error } = await parseBody(request, createDisputeSchema)
        if (error) return error

        const { questionId, gameId, mode, round, userAnswer, systemWasCorrect } = body

        // Verify question exists
        const question = await prisma.question.findUnique({
            where: { id: questionId },
            select: { id: true }
        })

        if (!question) {
            return badRequestResponse('Question not found')
        }

        // Check if dispute already exists for this user/question/mode/game combination
        const existingDispute = await prisma.answerDispute.findFirst({
            where: {
                userId: appUser.id,
                questionId,
                mode,
                gameId: gameId || null,
                status: 'PENDING'
            }
        })

        if (existingDispute) {
            return badRequestResponse('A pending dispute already exists for this answer')
        }

        // Create the dispute
        const dispute = await prisma.answerDispute.create({
            data: {
                userId: appUser.id,
                questionId,
                gameId: gameId || null,
                mode,
                round,
                userAnswer: userAnswer.trim(),
                systemWasCorrect
            }
        })

        return jsonResponse({
            success: true,
            disputeId: dispute.id
        }, 201)
    } catch (error) {
        console.error('Error creating dispute:', error)
        return serverErrorResponse('Failed to create dispute', error)
    }
}


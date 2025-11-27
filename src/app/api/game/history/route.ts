import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse, parseBody } from '@/lib/api-utils'
import { z } from 'zod'

const historySchema = z.object({
    questionId: z.string(),
    isCorrect: z.boolean(),
    pointsEarned: z.number()
})

export async function POST(request: NextRequest) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return unauthorizedResponse()
        }

        const { data: body, error } = await parseBody(request, historySchema)
        if (error) return error

        const { questionId, isCorrect, pointsEarned } = body

        const gameHistory = await prisma.gameHistory.create({
            data: {
                userId: session.user.id,
                questionId,
                correct: isCorrect,
                points: pointsEarned,
                timestamp: new Date()
            }
        })

        return jsonResponse(gameHistory)
    } catch (error) {
        return serverErrorResponse('Failed to save game history', error)
    }
} 
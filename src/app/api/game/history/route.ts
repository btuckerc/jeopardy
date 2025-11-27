import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse, parseBody } from '@/lib/api-utils'
import { z } from 'zod'

const historySchema = z.object({
    questionId: z.string(),
    isCorrect: z.boolean(),
    pointsEarned: z.number()
})

export async function POST(request: NextRequest) {
    try {
        const appUser = await getAppUser()

        if (!appUser) {
            return unauthorizedResponse()
        }

        const { data: body, error } = await parseBody(request, historySchema)
        if (error) return error

        const { questionId, isCorrect, pointsEarned } = body

        const gameHistory = await prisma.gameHistory.create({
            data: {
                userId: appUser.id,
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
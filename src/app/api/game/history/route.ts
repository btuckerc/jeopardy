import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { questionId, isCorrect, pointsEarned } = body

        // Create game history entry
        const gameHistory = await prisma.gameHistory.create({
            data: {
                userId: session.user.id,
                questionId,
                correct: isCorrect,
                points: pointsEarned,
                timestamp: new Date()
            }
        })

        return NextResponse.json(gameHistory)
    } catch (error) {
        console.error('Error saving game history:', error)
        return NextResponse.json(
            { error: 'Failed to save game history' },
            { status: 500 }
        )
    }
} 
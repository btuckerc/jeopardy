import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'

export async function POST(request: Request) {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const game = await prisma.game.create({
            data: {
                userId: session.user.id,
                useKnowledgeCategories: true
            }
        })

        return NextResponse.json(game)
    } catch (error) {
        console.error('Error creating game:', error)
        return NextResponse.json(
            { error: 'Failed to create game' },
            { status: 500 }
        )
    }
} 
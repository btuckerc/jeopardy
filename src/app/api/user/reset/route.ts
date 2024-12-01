import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function POST(request: Request) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Delete all user data in a transaction
        await prisma.$transaction([
            prisma.gameHistory.deleteMany({
                where: { userId: session.user.id }
            }),
            prisma.userProgress.deleteMany({
                where: { userId: session.user.id }
            })
        ])

        // Clear local storage data
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error resetting user data:', error)
        return NextResponse.json(
            { error: 'Failed to reset user data' },
            { status: 500 }
        )
    }
} 
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
        const { icon } = await request.json()

        const user = await prisma.user.upsert({
            where: { id: session.user.id },
            update: { selectedIcon: icon },
            create: {
                id: session.user.id,
                email: session.user.email!,
                selectedIcon: icon
            }
        })

        return NextResponse.json({ selectedIcon: user.selectedIcon })
    } catch (error) {
        console.error('Error updating icon:', error)
        return NextResponse.json(
            { error: 'Failed to update icon' },
            { status: 500 }
        )
    }
} 
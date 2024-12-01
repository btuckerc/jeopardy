import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

// Function to generate a random display name
function generateRandomDisplayName(): string {
    const adjectives = ['Quick', 'Clever', 'Bright', 'Sharp', 'Smart', 'Witty', 'Wise', 'Bold', 'Eager', 'Grand']
    const nouns = ['Scholar', 'Thinker', 'Master', 'Champion', 'Expert', 'Genius', 'Sage', 'Mind', 'Brain', 'Ace']

    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)]
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)]

    return `${randomAdjective}${randomNoun}`
}

export async function GET(request: Request) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        let user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                displayName: true,
                selectedIcon: true
            }
        })

        if (!user?.displayName) {
            // Generate and save a random display name
            const displayName = generateRandomDisplayName()
            user = await prisma.user.upsert({
                where: { id: session.user.id },
                update: { displayName },
                create: {
                    id: session.user.id,
                    email: session.user.email!,
                    displayName,
                    selectedIcon: '👤'  // Set default icon
                },
                select: {
                    displayName: true,
                    selectedIcon: true
                }
            })
        }

        return NextResponse.json({
            displayName: user.displayName,
            selectedIcon: user.selectedIcon || '👤'
        })
    } catch (error) {
        console.error('Error fetching display name:', error)
        return NextResponse.json(
            { error: 'Failed to fetch display name' },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { displayName } = await request.json()

        if (!displayName || typeof displayName !== 'string') {
            return NextResponse.json(
                { error: 'Display name is required' },
                { status: 400 }
            )
        }

        if (displayName.length < 3) {
            return NextResponse.json(
                { error: 'Display name must be at least 3 characters' },
                { status: 400 }
            )
        }

        if (displayName.length > 20) {
            return NextResponse.json(
                { error: 'Display name cannot exceed 20 characters' },
                { status: 400 }
            )
        }

        const user = await prisma.user.upsert({
            where: { id: session.user.id },
            update: { displayName },
            create: {
                id: session.user.id,
                email: session.user.email!,
                displayName
            },
            select: { displayName: true }
        })

        return NextResponse.json({ displayName: user.displayName })
    } catch (error) {
        console.error('Error updating display name:', error)
        return NextResponse.json(
            { error: 'Failed to update display name' },
            { status: 500 }
        )
    }
} 
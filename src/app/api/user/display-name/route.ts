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

async function syncUserData(supabase: any, userId: string, data: { displayName?: string | null, selectedIcon?: string | null }) {
    try {
        await supabase.auth.updateUser({
            data: {
                display_name: data.displayName ?? undefined,
                avatar_icon: data.selectedIcon ?? undefined
            }
        })
    } catch (error) {
        console.error('Error syncing with Supabase:', error)
        // Continue execution even if Supabase sync fails
    }
}

export async function GET(request: Request) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Use upsert to ensure user exists and get their data
        const user = await prisma.user.upsert({
            where: { id: session.user.id },
            create: {
                id: session.user.id,
                email: session.user.email!,
                displayName: generateRandomDisplayName(),
                selectedIcon: '👤'
            },
            update: {},
            select: {
                displayName: true,
                selectedIcon: true
            }
        })

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
        const { displayName, selectedIcon } = await request.json()

        if (displayName && typeof displayName !== 'string') {
            return NextResponse.json(
                { error: 'Display name must be a string' },
                { status: 400 }
            )
        }

        if (displayName && (displayName.length < 3 || displayName.length > 20)) {
            return NextResponse.json(
                { error: 'Display name must be between 3 and 20 characters' },
                { status: 400 }
            )
        }

        // Use upsert instead of update to handle potential race conditions
        const user = await prisma.user.upsert({
            where: { id: session.user.id },
            create: {
                id: session.user.id,
                email: session.user.email!,
                displayName: displayName || generateRandomDisplayName(),
                selectedIcon: selectedIcon || '👤'
            },
            update: {
                displayName: displayName || undefined,
                selectedIcon: selectedIcon === null ? null : selectedIcon || undefined
            },
            select: {
                displayName: true,
                selectedIcon: true
            }
        })

        // Sync with Supabase
        await syncUserData(supabase, session.user.id, {
            displayName: user.displayName ?? null,
            selectedIcon: user.selectedIcon ?? null
        })

        return NextResponse.json(user)
    } catch (error) {
        console.error('Error updating user data:', error)
        return NextResponse.json(
            { error: 'Failed to update user data' },
            { status: 500 }
        )
    }
} 
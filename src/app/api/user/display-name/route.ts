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
        // First try to get user data from Supabase
        const { data: { user: supabaseUser } } = await supabase.auth.getUser()
        let user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                displayName: true,
                selectedIcon: true
            }
        })

        // If data exists in Supabase but not in Prisma, sync to Prisma
        if (supabaseUser?.user_metadata?.display_name && !user?.displayName) {
            user = await prisma.user.update({
                where: { id: session.user.id },
                data: {
                    displayName: supabaseUser.user_metadata.display_name,
                    selectedIcon: supabaseUser.user_metadata.avatar_icon || '👤'
                },
                select: {
                    displayName: true,
                    selectedIcon: true
                }
            })
        }
        // If no data in either system, create new
        else if (!user?.displayName) {
            const displayName = generateRandomDisplayName()
            const defaultIcon = '👤'

            user = await prisma.user.upsert({
                where: { id: session.user.id },
                update: {
                    displayName,
                    selectedIcon: defaultIcon
                },
                create: {
                    id: session.user.id,
                    email: session.user.email!,
                    displayName,
                    selectedIcon: defaultIcon
                },
                select: {
                    displayName: true,
                    selectedIcon: true
                }
            })

            await syncUserData(supabase, session.user.id, {
                displayName: user.displayName ?? null,
                selectedIcon: user.selectedIcon ?? null
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

        const updateData: any = {}
        if (displayName) updateData.displayName = displayName
        if (selectedIcon !== undefined) updateData.selectedIcon = selectedIcon

        const user = await prisma.user.upsert({
            where: { id: session.user.id },
            update: updateData,
            create: {
                id: session.user.id,
                email: session.user.email!,
                ...updateData
            },
            select: {
                displayName: true,
                selectedIcon: true
            }
        })

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
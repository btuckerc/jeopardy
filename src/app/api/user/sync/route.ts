import { NextResponse } from 'next/server'
import { getClerkUserId, syncClerkUserToPrisma } from '@/lib/clerk-auth'

/**
 * POST /api/user/sync
 * Syncs the current Clerk user to our Prisma database.
 * Called when a user signs in and their Prisma record doesn't exist yet.
 */
export async function POST() {
    try {
        const clerkUserId = await getClerkUserId()
        
        if (!clerkUserId) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            )
        }
        
        const user = await syncClerkUserToPrisma(clerkUserId)
        
        if (!user) {
            return NextResponse.json(
                { error: 'Failed to sync user' },
                { status: 500 }
            )
        }
        
        return NextResponse.json({ user })
    } catch (error) {
        console.error('Error syncing user:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}


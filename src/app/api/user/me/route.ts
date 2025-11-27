import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/clerk-auth'

/**
 * GET /api/user/me
 * Returns the current authenticated user's data from Prisma.
 * This is used by client components to get the full user data including role.
 */
export async function GET() {
    try {
        const user = await getAppUser()
        
        if (!user) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            )
        }
        
        return NextResponse.json({ user })
    } catch (error) {
        console.error('Error fetching user:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}


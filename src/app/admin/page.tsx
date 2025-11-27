import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/clerk-auth'
import { prisma } from '@/lib/prisma'
import AdminClient from './AdminClient'

/**
 * Admin page - Server component that handles authentication and authorization.
 * 
 * This is more secure than client-side auth checks because:
 * 1. The check happens on the server before any HTML is sent
 * 2. Unauthorized users can't see the admin UI at all
 * 3. No loading states or flashes - immediate redirect or render
 */
export default async function AdminPage() {
    // Get the current user from Clerk + Prisma
    const user = await getAppUser()
    
    // Not authenticated - redirect to sign in
    if (!user) {
        redirect('/sign-in?redirect_url=/admin')
    }
    
    // Not an admin - show access denied
    if (user.role !== 'ADMIN') {
        return (
            <div className="container mx-auto p-4">
                <div className="text-center p-8">
                    <h1 className="text-2xl font-bold text-black mb-4">Access Denied</h1>
                    <p className="text-gray-600">
                        Admin privileges required to access this page.
                    </p>
                </div>
            </div>
        )
    }
    
    // User is admin - fetch initial data server-side
    let initialGames: any[] = []
    try {
        // Fetch games grouped by air date
        const games = await prisma.question.groupBy({
            by: ['airDate'],
            _count: {
                id: true
            },
            orderBy: {
                airDate: 'desc'
            },
            where: {
                airDate: {
                    not: null
                }
            }
        })
        
        initialGames = games.map(g => ({
            airDate: g.airDate,
            questionCount: g._count.id
        }))
    } catch (error) {
        console.error('Error fetching initial games:', error)
        // Continue with empty games - the client can retry
    }
    
    // Render the admin client component with verified user and initial data
    return <AdminClient user={user} initialGames={initialGames} />
}

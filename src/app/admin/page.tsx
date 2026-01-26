import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/clerk-auth'
import AdminClient from './AdminClient'

/**
 * Admin page - Server component that handles authentication and authorization.
 * 
 * This is more secure than client-side auth checks because:
 * 1. The check happens on the server before any HTML is sent
 * 2. Unauthorized users can't see the admin UI at all
 * 3. No loading states or flashes - immediate redirect or render
 * 
 * Performance optimization:
 * - No longer prefetch game data since default tab (metrics-overview) uses React Query
 * - Data is fetched on-demand by each tab when needed
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
    
    // Render admin client with verified user
    // Initial games data is no longer prefetched - each tab fetches its own data via React Query
    // This improves initial page load time significantly
    return <AdminClient user={user} initialGames={[]} />
}

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
    '/',
    '/about',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/api/cron(.*)', // Cron jobs don't need user auth
    '/api/categories(.*)', // Public category browsing
    '/api/questions(.*)', // Public question access
    '/api/leaderboard(.*)', // Public leaderboard
])

// Define admin routes that require admin role
const isAdminRoute = createRouteMatcher([
    '/admin(.*)',
    '/api/admin(.*)',
])

export default clerkMiddleware(async (auth, request) => {
    // Admin routes require authentication and admin role
    if (isAdminRoute(request)) {
        const { userId } = await auth()
        
        if (!userId) {
            // Redirect to sign-in for unauthenticated users
            const signInUrl = new URL('/sign-in', request.url)
            signInUrl.searchParams.set('redirect_url', request.url)
            return NextResponse.redirect(signInUrl)
        }
        
        // Note: Admin role check is handled at the API route level
        // by checking the Prisma User.role field via getAppUser()
        // This is because Clerk doesn't have our role data until we sync it
    }
    
    // Protect all non-public routes
    if (!isPublicRoute(request)) {
        await auth.protect()
    }
})

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
}


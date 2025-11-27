'use client'

import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from 'next-auth/react'

interface SessionUser {
    id: string
    email?: string | null
    name?: string | null
    image?: string | null
    role?: string | null
    displayName?: string | null
    selectedIcon?: string | null
    avatarBackground?: string | null
}

/**
 * Client-side auth hook that works with server-provided session.
 * 
 * When the session is passed to SessionProvider from the server,
 * useSession() returns the session immediately without a loading state.
 * This eliminates the flash of unauthenticated content.
 */
export function useAuth() {
    const { data: session, status } = useSession()
    
    // When session is provided from server, status is never 'loading' on initial render
    const loading = status === 'loading'
    
    let user: SessionUser | null = null
    if (session?.user) {
        user = {
            id: (session.user as any).id || '',
            email: session.user.email,
            name: session.user.name,
            image: session.user.image,
            role: (session.user as any).role,
            displayName: (session.user as any).displayName,
            selectedIcon: (session.user as any).selectedIcon,
            avatarBackground: (session.user as any).avatarBackground,
        }
    }

    const signIn = async (email: string) => {
        await nextAuthSignIn('email', { email, redirect: false })
    }

    const signOut = async () => {
        await nextAuthSignOut({ redirect: false })
    }

    return { user, loading, signIn, signOut }
}

// Re-export SessionProvider for convenience
export { SessionProvider } from 'next-auth/react'

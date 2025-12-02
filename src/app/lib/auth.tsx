'use client'

import { useUser, useClerk } from '@clerk/nextjs'
import { useState, useEffect } from 'react'

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
 * Client-side auth hook that works with Clerk.
 * 
 * This hook fetches the full user data from our API (including role from Prisma)
 * since Clerk doesn't store our custom user fields.
 */
export function useAuth() {
    const { isLoaded, isSignedIn, user: clerkUser } = useUser()
    const { signOut, openSignIn } = useClerk()
    const [appUser, setAppUser] = useState<SessionUser | null>(null)
    const [fetchingUser, setFetchingUser] = useState(false)
    const [hasFetched, setHasFetched] = useState(false)
    
    // Fetch app user data from our API when Clerk is loaded and signed in
    // Deferred slightly to avoid blocking initial render
    useEffect(() => {
        async function fetchAppUser() {
            if (!isLoaded || !isSignedIn || fetchingUser || hasFetched) return
            
            // Small delay to avoid blocking initial render
            await new Promise(resolve => setTimeout(resolve, 50))
            
            if (fetchingUser || hasFetched) return // Check again after delay
            
            setFetchingUser(true)
            try {
                // Fetch user data including role from our API
                const response = await fetch('/api/user/me')
                if (response.ok) {
                    const data = await response.json()
                    setAppUser({
                        id: data.user.id,
                        email: data.user.email,
                        name: data.user.name,
                        image: data.user.image,
                        role: data.user.role,
                        displayName: data.user.displayName,
                        selectedIcon: data.user.selectedIcon,
                        avatarBackground: data.user.avatarBackground,
                    })
                } else {
                    // If fetch fails, use basic Clerk data
                    setAppUser({
                        id: clerkUser?.id || '',
                        email: clerkUser?.emailAddresses[0]?.emailAddress,
                        name: clerkUser?.fullName,
                        image: clerkUser?.imageUrl,
                        role: null,
                        displayName: null,
                        selectedIcon: null,
                        avatarBackground: null,
                    })
                }
            } catch (error) {
                console.error('Error fetching app user:', error)
                // Fallback to basic Clerk data
                if (clerkUser) {
                    setAppUser({
                        id: clerkUser.id,
                        email: clerkUser.emailAddresses[0]?.emailAddress,
                        name: clerkUser.fullName,
                        image: clerkUser.imageUrl,
                        role: null,
                        displayName: null,
                        selectedIcon: null,
                        avatarBackground: null,
                    })
                }
            } finally {
                setFetchingUser(false)
                setHasFetched(true)
            }
        }
        
        fetchAppUser()
    }, [isLoaded, isSignedIn, clerkUser, fetchingUser, hasFetched])
    
    // Reset state when user signs out
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            setAppUser(null)
            setHasFetched(false)
        }
    }, [isLoaded, isSignedIn])
    
    const loading = !isLoaded || (isSignedIn && !hasFetched)

    const signIn = async () => {
        openSignIn()
    }

    const handleSignOut = async () => {
        await signOut()
        setAppUser(null)
        setHasFetched(false)
    }

    return { user: appUser, loading, signIn, signOut: handleSignOut }
}

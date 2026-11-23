'use client'

import { useUser, useClerk } from '@clerk/nextjs'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { AppUser } from '@/lib/clerk-auth'

export interface SessionUser {
    id: string
    email?: string | null
    name?: string | null
    image?: string | null
    role?: string | null
    displayName?: string | null
    selectedIcon?: string | null
    avatarBackground?: string | null
}

interface AuthContextValue {
    user: SessionUser | null
    loading: boolean
    signIn: () => Promise<void>
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toSessionUser(appUser: AppUser | null | undefined): SessionUser | null {
    if (!appUser) return null
    return {
        id: appUser.id,
        email: appUser.email,
        name: appUser.name,
        image: appUser.image,
        role: appUser.role,
        displayName: appUser.displayName,
        selectedIcon: appUser.selectedIcon,
        avatarBackground: appUser.avatarBackground,
    }
}

export function AuthProvider({
    initialUser,
    children,
}: {
    initialUser: AppUser | null
    children: React.ReactNode
}) {
    const { isLoaded, isSignedIn, user: clerkUser } = useUser()
    const { signOut, openSignIn } = useClerk()
    const [appUser, setAppUser] = useState<SessionUser | null>(() => toSessionUser(initialUser))
    const [hasFetched, setHasFetched] = useState<boolean>(() => Boolean(initialUser))
    const fetchingRef = useRef(false)

    // Keep state aligned when server props update (e.g. after router.refresh())
    useEffect(() => {
        if (initialUser) {
            setAppUser(toSessionUser(initialUser))
            setHasFetched(true)
        }
    }, [initialUser])

    // Only fetch /api/user/me once for the whole app if Clerk signs in client-side without server user
    useEffect(() => {
        if (!isLoaded) return

        if (!isSignedIn) {
            setAppUser(null)
            setHasFetched(true)
            return
        }

        if (hasFetched || fetchingRef.current) return

        let cancelled = false
        fetchingRef.current = true

        async function fetchAppUser() {
            try {
                const response = await fetch('/api/user/me')
                if (cancelled) return

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
                } else if (clerkUser) {
                    setAppUser({
                        id: clerkUser.id || '',
                        email: clerkUser.emailAddresses[0]?.emailAddress,
                        name: clerkUser.fullName,
                        image: clerkUser.imageUrl,
                        role: null,
                        displayName: null,
                        selectedIcon: null,
                        avatarBackground: null,
                    })
                }
            } catch (error) {
                if (cancelled) return
                console.error('Error fetching app user:', error)
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
                fetchingRef.current = false
                if (!cancelled) {
                    setHasFetched(true)
                }
            }
        }

        void fetchAppUser()

        return () => {
            cancelled = true
        }
    }, [isLoaded, isSignedIn, clerkUser, hasFetched])

    const handleSignIn = useCallback(async () => {
        openSignIn()
    }, [openSignIn])

    const handleSignOut = useCallback(async () => {
        await signOut()
        setAppUser(null)
        setHasFetched(true)
    }, [signOut])

    // If we already have initialUser from SSR, don't block UI waiting for Clerk client hydration
    const loading = !appUser && (!isLoaded || (Boolean(isSignedIn) && !hasFetched))

    const value = useMemo<AuthContextValue>(() => ({
        user: appUser,
        loading,
        signIn: handleSignIn,
        signOut: handleSignOut,
    }), [appUser, loading, handleSignIn, handleSignOut])

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Client-side auth hook backed by server-hydrated AuthProvider context.
 * Eliminates duplicate /api/user/me fetches and authLoading flashes across components.
 */
export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}

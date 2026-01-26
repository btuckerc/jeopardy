'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useAuth } from './lib/auth'
import { useRouter } from 'next/navigation'
import { ActivityTracker } from './components/ActivityTracker'

interface ProvidersProps {
    children: React.ReactNode
}

function GuestSessionClaimer() {
    const { isLoaded, isSignedIn } = useUser()
    const { user } = useAuth()
    const router = useRouter()
    const [hasClaimed, setHasClaimed] = useState(false)
    const [isClaiming, setIsClaiming] = useState(false)

    useEffect(() => {
        // Only run when Clerk is loaded and user is signed in
        if (!isLoaded || !isSignedIn || !user || hasClaimed || isClaiming) return

        // Defer claiming to avoid blocking initial render
        const timeoutId = setTimeout(() => {
        const claimPendingSession = async () => {
            const sessionId = localStorage.getItem('trivrdy_pendingGuestSessionId')
            const sessionType = localStorage.getItem('trivrdy_pendingGuestSessionType')

            if (!sessionId) {
                setHasClaimed(true)
                return
            }

            setIsClaiming(true)

            try {
                const response = await fetch('/api/guest-sessions/claim', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ guestSessionId: sessionId })
                })

                if (response.ok) {
                    const data = await response.json()
                    
                    // Clear localStorage immediately
                    localStorage.removeItem('trivrdy_pendingGuestSessionId')
                    localStorage.removeItem('trivrdy_pendingGuestSessionType')

                    // Small delay to ensure state is cleared before redirect
                    await new Promise(resolve => setTimeout(resolve, 100))

                    // Redirect based on session type and returned redirect path
                    if (data.redirectPath) {
                        router.replace(data.redirectPath)
                    } else if (sessionType === 'RANDOM_GAME' && data.gameId) {
                        router.replace(`/game/${data.gameId}`)
                    } else if (sessionType === 'DAILY_CHALLENGE') {
                        router.replace('/daily-challenge')
                    } else {
                        router.replace('/')
                    }
                } else {
                    // Session expired or already claimed - clear it
                    localStorage.removeItem('trivrdy_pendingGuestSessionId')
                    localStorage.removeItem('trivrdy_pendingGuestSessionType')
                }
            } catch (error) {
                console.error('Error claiming guest session:', error)
                // Clear on error to prevent retry loops
                localStorage.removeItem('trivrdy_pendingGuestSessionId')
                localStorage.removeItem('trivrdy_pendingGuestSessionType')
            } finally {
                setIsClaiming(false)
                setHasClaimed(true)
            }
        }

        claimPendingSession()
        }, 200) // Small delay to avoid blocking initial render

        return () => clearTimeout(timeoutId)
    }, [isLoaded, isSignedIn, user, hasClaimed, isClaiming, router])

    return null
}

export function Providers({ children }: ProvidersProps) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30 * 1000, // 30 seconds
                gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
                retry: 1,
                refetchOnWindowFocus: false,
            },
        },
    }))

    return (
        <QueryClientProvider client={queryClient}>
            <GuestSessionClaimer />
            <ActivityTracker />
            {children}
        </QueryClientProvider>
    )
}

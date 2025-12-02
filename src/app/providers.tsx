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
                    // Use replace instead of push to avoid adding to history and prevent back button issues
                    if (data.redirectPath) {
                        // Use the redirect path from the claim response (for RANDOM_QUESTION)
                        router.replace(data.redirectPath)
                    } else if (sessionType === 'RANDOM_GAME' && data.gameId) {
                        // Redirect to the claimed game
                        router.replace(`/game/${data.gameId}`)
                    } else if (sessionType === 'DAILY_CHALLENGE') {
                        // Redirect to daily challenge page
                        router.replace('/daily-challenge')
                    } else {
                        // Fallback: redirect to home
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
    }, [isLoaded, isSignedIn, user, hasClaimed, isClaiming, router])

    return null
}

export function Providers({ children }: ProvidersProps) {
    const [queryClient] = useState(() => new QueryClient())

    return (
        <QueryClientProvider client={queryClient}>
            <GuestSessionClaimer />
            <ActivityTracker />
            {children}
        </QueryClientProvider>
    )
}

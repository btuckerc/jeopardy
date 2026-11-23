'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { AuthProvider, useAuth } from './lib/auth'
import { useRouter } from 'next/navigation'
import { ActivityTracker } from './components/ActivityTracker'
import type { AppUser } from '@/lib/clerk-auth'

interface ProvidersProps {
    initialUser: AppUser | null
    children: React.ReactNode
}

function GuestSessionClaimer() {
    const { isLoaded, isSignedIn } = useUser()
    const { user } = useAuth()
    const router = useRouter()
    const [hasClaimed, setHasClaimed] = useState(false)
    const [isClaiming, setIsClaiming] = useState(false)

    useEffect(() => {
        if (!isLoaded || !isSignedIn || !user || hasClaimed || isClaiming) return

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

                        localStorage.removeItem('trivrdy_pendingGuestSessionId')
                        localStorage.removeItem('trivrdy_pendingGuestSessionType')

                        await new Promise(resolve => setTimeout(resolve, 100))

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
                        localStorage.removeItem('trivrdy_pendingGuestSessionId')
                        localStorage.removeItem('trivrdy_pendingGuestSessionType')
                    }
                } catch (error) {
                    console.error('Error claiming guest session:', error)
                    localStorage.removeItem('trivrdy_pendingGuestSessionId')
                    localStorage.removeItem('trivrdy_pendingGuestSessionType')
                } finally {
                    setIsClaiming(false)
                    setHasClaimed(true)
                }
            }

            void claimPendingSession()
        }, 200)

        return () => clearTimeout(timeoutId)
    }, [isLoaded, isSignedIn, user, hasClaimed, isClaiming, router])

    return null
}

export function Providers({ initialUser, children }: ProvidersProps) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30 * 1000,
                gcTime: 5 * 60 * 1000,
                retry: 1,
                refetchOnWindowFocus: false,
            },
        },
    }))

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider initialUser={initialUser}>
                <GuestSessionClaimer />
                <ActivityTracker />
                {children}
            </AuthProvider>
        </QueryClientProvider>
    )
}

'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

/**
 * ActivityTracker component
 * Tracks user activity (last online time and current page) for authenticated users
 * Updates are throttled client-side (once per page navigation) and server-side (once per minute)
 */
export function ActivityTracker() {
    const { isLoaded, isSignedIn } = useUser()
    const pathname = usePathname()
    const lastPathRef = useRef<string | null>(null)
    const isTrackingRef = useRef(false)

    useEffect(() => {
        // Only track for authenticated users
        if (!isLoaded || !isSignedIn) {
            return
        }

        // Skip if we've already tracked this path
        if (lastPathRef.current === pathname) {
            return
        }

        // Prevent concurrent requests
        if (isTrackingRef.current) {
            return
        }

        // Track the current path
        const trackActivity = async () => {
            isTrackingRef.current = true
            lastPathRef.current = pathname

            try {
                await fetch('/api/user/activity', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ path: pathname }),
                })
            } catch (error) {
                // Silently fail - activity tracking shouldn't break the app
                console.error('Failed to track activity:', error)
            } finally {
                isTrackingRef.current = false
            }
        }

        trackActivity()
    }, [isLoaded, isSignedIn, pathname])

    // Track activity on page unload using sendBeacon
    useEffect(() => {
        if (!isLoaded || !isSignedIn) {
            return
        }

        const handleUnload = () => {
            // Use sendBeacon for reliable delivery on page unload
            if (navigator.sendBeacon && pathname) {
                const data = JSON.stringify({ path: pathname })
                const blob = new Blob([data], { type: 'application/json' })
                navigator.sendBeacon('/api/user/activity', blob)
            }
        }

        window.addEventListener('beforeunload', handleUnload)
        return () => window.removeEventListener('beforeunload', handleUnload)
    }, [isLoaded, isSignedIn, pathname])

    // Component doesn't render anything
    return null
}


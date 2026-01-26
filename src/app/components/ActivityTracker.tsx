'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

/**
 * ActivityTracker component
 * Tracks user activity (last online time and current page) for authenticated users
 * Updates are throttled client-side (once per page navigation) and server-side (once per minute)
 * Deferred to avoid blocking initial render
 */
export function ActivityTracker() {
    const { isLoaded, isSignedIn } = useUser()
    const pathname = usePathname()
    const lastPathRef = useRef<string | null>(null)
    const isTrackingRef = useRef(false)
    const timeoutRef = useRef<NodeJS.Timeout>()

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

        // Clear any pending timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }

        // Defer tracking to avoid blocking navigation
        // Use requestIdleCallback if available, otherwise setTimeout
        const trackActivity = () => {
            isTrackingRef.current = true
            lastPathRef.current = pathname

            fetch('/api/user/activity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path: pathname }),
            })
                .catch(() => {
                    // Silently fail - activity tracking shouldn't break the app
                })
                .finally(() => {
                    isTrackingRef.current = false
                })
        }

        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            timeoutRef.current = setTimeout(() => {
                requestIdleCallback(trackActivity, { timeout: 2000 })
            }, 100) as NodeJS.Timeout
        } else {
            timeoutRef.current = setTimeout(trackActivity, 500)
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
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


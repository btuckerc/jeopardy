'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import {
    ATTRIBUTION_STORAGE_KEY,
    buildStoredAttribution,
    normalizeLocale,
    normalizeTimezone,
    parseStoredAttribution,
} from '@/lib/user-telemetry'

function buildActivityPayload(path: string) {
    const timezone = typeof window !== 'undefined'
        ? normalizeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
        : undefined
    const locale = typeof navigator !== 'undefined'
        ? normalizeLocale(navigator.languages?.[0] || navigator.language)
        : undefined
    const attribution = typeof window !== 'undefined'
        ? parseStoredAttribution(localStorage.getItem(ATTRIBUTION_STORAGE_KEY))
        : null

    return {
        path,
        locale,
        timezone,
        referrerHost: attribution?.referrerHost,
        acquisitionSource: attribution?.acquisitionSource,
        acquisitionMedium: attribution?.acquisitionMedium,
        acquisitionCampaign: attribution?.acquisitionCampaign,
    }
}

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
        if (typeof window === 'undefined') {
            return
        }

        const existingAttribution = parseStoredAttribution(localStorage.getItem(ATTRIBUTION_STORAGE_KEY))
        if (existingAttribution) {
            return
        }

        const attribution = buildStoredAttribution({
            search: window.location.search,
            referrer: document.referrer,
            currentHost: window.location.host,
        })

        if (attribution) {
            localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution))
        }
    }, [])

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
                body: JSON.stringify(buildActivityPayload(pathname)),
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
                const data = JSON.stringify(buildActivityPayload(pathname))
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

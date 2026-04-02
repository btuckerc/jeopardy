'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

import { activeSiteAnnouncement, getSiteAnnouncementStorageKey } from '@/lib/site-announcement'

export default function SiteAnnouncementBanner() {
    const pathname = usePathname()
    const announcement = activeSiteAnnouncement
    const [isReady, setIsReady] = useState(false)
    const [dismissed, setDismissed] = useState(false)

    const isHiddenOnRoute = useMemo(() => {
        if (!announcement) {
            return false
        }

        return announcement.hiddenPathPrefixes?.some((prefix) => pathname.startsWith(prefix)) ?? false
    }, [announcement, pathname])

    useEffect(() => {
        if (!announcement) {
            setIsReady(true)
            return
        }

        try {
            const storageKey = getSiteAnnouncementStorageKey(announcement.id)
            setDismissed(window.localStorage.getItem(storageKey) === 'true')
        } catch {
            setDismissed(false)
        } finally {
            setIsReady(true)
        }
    }, [announcement])

    if (!announcement || !isReady || dismissed || isHiddenOnRoute) {
        return null
    }

    const handleDismiss = () => {
        try {
            window.localStorage.setItem(getSiteAnnouncementStorageKey(announcement.id), 'true')
        } catch {
            // Best-effort persistence only.
        }

        setDismissed(true)
    }

    return (
        <section
            aria-label={announcement.label}
            aria-live="polite"
            className="relative overflow-hidden border-b border-slate-200/80 bg-[linear-gradient(90deg,rgba(251,191,36,0.08)_0%,rgba(255,255,255,0.96)_22%,rgba(239,246,255,0.92)_100%)]"
            role="status"
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-blue-300/70" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_left,_rgba(251,191,36,0.14),_transparent_30%),radial-gradient(circle_at_right,_rgba(59,130,246,0.1),_transparent_34%)]" />

            <div className="relative mx-auto flex max-w-7xl items-start gap-3 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-300/80 bg-white/75 text-amber-700 shadow-[0_1px_6px_rgba(15,23,42,0.05)] backdrop-blur-sm">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className="inline-flex items-center rounded-full border border-blue-200/80 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-700 shadow-[0_1px_4px_rgba(30,58,138,0.08)] backdrop-blur-sm">
                            {announcement.label}
                        </span>
                        <p className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
                            {announcement.title}
                        </p>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600 sm:max-w-4xl">
                        {announcement.body}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleDismiss}
                    className="inline-flex shrink-0 items-center rounded-full border border-slate-200/80 bg-white/75 px-3 py-1.5 text-sm font-medium text-slate-500 shadow-[0_1px_6px_rgba(15,23,42,0.05)] backdrop-blur-sm transition-all hover:border-blue-200 hover:bg-white hover:text-blue-700"
                    aria-label={`Dismiss ${announcement.label.toLowerCase()}`}
                >
                    Dismiss
                </button>
            </div>
        </section>
    )
}

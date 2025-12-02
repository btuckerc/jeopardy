'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export function PageTitle() {
    const pathname = usePathname()

    useEffect(() => {
        // Only update title if we're on a page without its own metadata
        // Next.js metadata should handle titles, but this provides fallback for dynamic routes
        const baseTitle = 'trivrdy - Free Jeopardy Practice & Study Tool | 12,000+ Questions'
        let pageTitle = baseTitle

        switch (pathname) {
            case '/game':
                pageTitle = 'Play Jeopardy Online | Game Mode | trivrdy'
                break
            case '/practice':
                pageTitle = 'Jeopardy Flashcards & Study Mode | Study Trivia | trivrdy'
                break
            case '/stats':
                pageTitle = 'Track Trivia Progress | Your Jeopardy Stats | trivrdy'
                break
            case '/settings':
                pageTitle = `${baseTitle} - Settings`
                break
            case '/leaderboard':
                pageTitle = 'Trivia Rankings & Leaderboard | Jeopardy Stats | trivrdy'
                break
            default:
                // Use the base title for home page - matches metadata
                pageTitle = baseTitle
        }

        // Only update if different to avoid unnecessary DOM manipulation
        if (document.title !== pageTitle) {
            document.title = pageTitle
        }
    }, [pathname])

    return null
}
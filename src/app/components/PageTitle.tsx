'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export function PageTitle() {
    const pathname = usePathname()

    useEffect(() => {
        const baseTitle = 'trivrdy - study jeopardy questions online'
        let pageTitle = baseTitle

        switch (pathname) {
            case '/game':
                pageTitle = `${baseTitle} - game mode`
                break
            case '/practice':
                pageTitle = `${baseTitle} - practice mode`
                break
            case '/stats':
                pageTitle = `${baseTitle} - statistics`
                break
            case '/settings':
                pageTitle = `${baseTitle} - settings`
                break
        }

        document.title = pageTitle
    }, [pathname])

    return null
}
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import KeyboardShortcuts from './KeyboardShortcuts'

function isEditableTarget(target: HTMLElement | null): boolean {
    if (!target) return false
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
        return true
    }
    const role = target.getAttribute('role')
    return role === 'combobox' || role === 'listbox' || role === 'textbox'
}

export default function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const [showShortcuts, setShowShortcuts] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!mounted) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (isEditableTarget(e.target as HTMLElement | null)) {
                return
            }

            if (e.key === '?') {
                e.preventDefault()
                setShowShortcuts((prev) => !prev)
                return
            }

            if (e.key === 'Escape' && showShortcuts) {
                setShowShortcuts(false)
                return
            }

            // Do not trigger navigation shortcuts when any modal/dialog is open or with modifiers
            if (showShortcuts || e.ctrlKey || e.metaKey || e.altKey) {
                return
            }

            const hasOpenModal = document.querySelector('[role="dialog"]')
            if (hasOpenModal) return

            switch (e.key.toLowerCase()) {
                case 'g':
                    e.preventDefault()
                    router.push('/game')
                    break
                case 'd':
                    e.preventDefault()
                    router.push('/daily-challenge')
                    break
                case 's':
                    e.preventDefault()
                    router.push('/stats')
                    break
                case 'l':
                    e.preventDefault()
                    router.push('/leaderboard')
                    break
                case 'p':
                    e.preventDefault()
                    router.push('/practice')
                    break
                case 'h':
                    e.preventDefault()
                    router.push('/')
                    break
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [mounted, router, showShortcuts])

    return (
        <>
            {children}
            <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
        </>
    )
}

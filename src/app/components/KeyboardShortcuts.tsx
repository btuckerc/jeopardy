'use client'

import { useEffect, useRef } from 'react'
import { useScrollLock } from '@/hooks/useScrollLock'

interface KeyboardShortcutsProps {
    isOpen: boolean
    onClose: () => void
}

export default function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
    const closeButtonRef = useRef<HTMLButtonElement>(null)
    const previousFocusRef = useRef<HTMLElement | null>(null)

    useScrollLock(isOpen)

    useEffect(() => {
        if (!isOpen) return
        previousFocusRef.current = document.activeElement as HTMLElement | null
        closeButtonRef.current?.focus()

        return () => {
            previousFocusRef.current?.focus?.()
        }
    }, [isOpen])

    if (!isOpen) return null

    const shortcuts = [
        { key: 'G', description: 'Go to Game Hub' },
        { key: 'D', description: 'Go to Daily Challenge' },
        { key: 'S', description: 'Go to Stats' },
        { key: 'L', description: 'Go to Leaderboard' },
        { key: 'P', description: 'Go to Study Mode' },
        { key: 'H', description: 'Go to Home' },
        { key: '?', description: 'Show / Hide Keyboard Shortcuts' },
        { key: 'Esc', description: 'Close modals and menus' },
    ]

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto animate-fade-in">
            <div
                className="fixed inset-0 bg-slate-950/50 transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />
            <div className="flex min-h-full items-center justify-center p-4">
                <div
                    className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-fade-in-slide-down"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="shortcuts-title"
                    data-shortcuts-modal="true"
                >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                        <h2 id="shortcuts-title" className="text-lg font-bold text-slate-900">
                            Keyboard Shortcuts
                        </h2>
                        <button
                            ref={closeButtonRef}
                            type="button"
                            onClick={onClose}
                            className="flex h-11 w-11 items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
                            aria-label="Close shortcuts"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="px-6 py-5">
                        <div className="space-y-2.5">
                            {shortcuts.map((shortcut) => (
                                <div key={shortcut.key} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                                    <span className="text-sm text-slate-700">{shortcut.description}</span>
                                    <kbd className="px-2.5 py-1 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-md">
                                        {shortcut.key}
                                    </kbd>
                                </div>
                            ))}
                        </div>
                        <p className="mt-5 text-xs text-slate-500 text-center">
                            Shortcuts are inactive while typing in form fields
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

'use client'

import { useEffect } from 'react'

let lockCount = 0
let previousOverflow = ''

export function useScrollLock(locked: boolean) {
    useEffect(() => {
        if (!locked) return

        const root = document.documentElement
        if (lockCount === 0) {
            previousOverflow = root.style.overflow
            root.style.overflow = 'hidden'
        }
        lockCount += 1

        return () => {
            lockCount = Math.max(0, lockCount - 1)
            if (lockCount === 0) {
                root.style.overflow = previousOverflow
            }
        }
    }, [locked])
}

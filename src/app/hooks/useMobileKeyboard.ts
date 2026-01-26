'use client'

import { useEffect, useCallback, RefObject } from 'react'

/**
 * Hook to handle mobile keyboard appearance and scroll inputs into view.
 * 
 * This hook provides a utility function that scrolls an input element into
 * the visible viewport area when focused, accounting for the mobile keyboard.
 * 
 * Usage:
 * ```tsx
 * const inputRef = useRef<HTMLInputElement>(null)
 * const { scrollIntoView } = useMobileKeyboard()
 * 
 * <input 
 *   ref={inputRef} 
 *   onFocus={() => scrollIntoView(inputRef)} 
 * />
 * ```
 */
export function useMobileKeyboard() {
    /**
     * Scrolls the referenced input element into view after a delay.
     * The delay accounts for the keyboard animation completing.
     * 
     * @param ref - React ref to the input element
     * @param delay - Milliseconds to wait before scrolling (default: 300)
     */
    const scrollIntoView = useCallback((
        ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
        delay: number = 300
    ) => {
        if (!ref?.current) return
        
        const element = ref.current
        
        // Use setTimeout to wait for keyboard animation to complete
        setTimeout(() => {
            // Check if element is still mounted and focused
            if (!element || document.activeElement !== element) return
            
            // Use scrollIntoView with 'center' to position input in middle of visible area
            element.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'nearest'
            })
        }, delay)
    }, [])

    /**
     * For modal contexts: scrolls the modal container to show the input.
     * Call this on input focus when the input is inside a scrollable modal.
     * 
     * @param inputRef - React ref to the input element
     * @param containerRef - React ref to the scrollable container
     * @param delay - Milliseconds to wait before scrolling (default: 300)
     */
    const scrollModalToInput = useCallback((
        inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
        containerRef: RefObject<HTMLElement | null>,
        delay: number = 300
    ) => {
        if (!inputRef?.current || !containerRef?.current) return
        
        const input = inputRef.current
        const container = containerRef.current
        
        setTimeout(() => {
            if (!input || document.activeElement !== input) return
            
            // Calculate position relative to container
            const inputRect = input.getBoundingClientRect()
            const containerRect = container.getBoundingClientRect()
            
            // Scroll container so input is visible with some padding above
            const scrollTarget = container.scrollTop + (inputRect.top - containerRect.top) - 100
            
            container.scrollTo({
                top: Math.max(0, scrollTarget),
                behavior: 'smooth'
            })
        }, delay)
    }, [])

    return { 
        scrollIntoView,
        scrollModalToInput
    }
}

/**
 * Standalone utility function for cases where the hook pattern isn't needed.
 * Can be imported and used directly in event handlers.
 */
export function scrollInputIntoView(
    element: HTMLInputElement | HTMLTextAreaElement | null,
    delay: number = 300
) {
    if (!element) return
    
    setTimeout(() => {
        if (!element || document.activeElement !== element) return
        element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
        })
    }, delay)
}

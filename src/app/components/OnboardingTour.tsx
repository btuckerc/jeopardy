'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import TourTooltip from './TourTooltip'
import { useOnboarding } from '@/app/hooks/useOnboarding'

interface TourStep {
    targetId: string
    title: string
    description: string
    position: 'top' | 'bottom' | 'left' | 'right'
}

const tourSteps: TourStep[] = [
    {
        targetId: 'daily-challenge-card',
        title: 'Welcome to trivrdy! 🎉',
        description: 'Practice with real Jeopardy questions, track your progress, and compete on the leaderboard. Start each day with a fresh Final Jeopardy question and build your streak!',
        position: 'bottom'
    },
    {
        targetId: 'play-game-card',
        title: 'Play Full Games',
        description: 'Play complete Jeopardy games with Single, Double, and Final rounds. Choose from random games or customize your experience.',
        position: 'bottom'
    },
    {
        targetId: 'practice-card',
        title: 'Study Mode',
        description: 'Focus on specific categories, rounds, or challenge yourself with triple stumpers. Perfect for targeted practice.',
        position: 'top'  // Changed to 'top' for better positioning on lower elements
    }
]

interface OnboardingTourProps {
    userId?: string | null
}

// Debounce utility for scroll/resize events
function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number) {
    let timeoutId: ReturnType<typeof setTimeout>
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => fn(...args), delay)
    }
}

export default function OnboardingTour({ userId }: OnboardingTourProps) {
    const { showTour, currentStep, nextStep, skipTour, completeTour } = useOnboarding(userId)
    const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
    const [actualPosition, setActualPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom')
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
    
    // Refs for cleanup
    const resizeObserverRef = useRef<ResizeObserver | null>(null)
    const rafIdRef = useRef<number | null>(null)
    const isCalculatingRef = useRef(false)
    
    // Tooltip dimensions (can be measured or estimated)
    const TOOLTIP_WIDTH = 340
    const TOOLTIP_HEIGHT = 220
    const GAP = 16
    const VIEWPORT_PADDING = 20
    
    // Comprehensive position calculation with viewport boundary detection
    const calculateOptimalPosition = useCallback((element: HTMLElement, preferredPosition: 'top' | 'bottom' | 'left' | 'right') => {
        const rect = element.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        
        // Calculate available space in all directions
        const spaceAbove = rect.top - VIEWPORT_PADDING
        const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_PADDING
        const spaceLeft = rect.left - VIEWPORT_PADDING
        const spaceRight = viewportWidth - rect.right - VIEWPORT_PADDING
        
        // Calculate required space for each direction
        const needHeight = TOOLTIP_HEIGHT + GAP
        const needWidth = TOOLTIP_WIDTH + GAP
        
        // Score each position based on available space and preference
        const positions: { position: 'top' | 'bottom' | 'left' | 'right'; score: number }[] = [
            { 
                position: 'bottom', 
                score: (spaceBelow >= needHeight ? 100 : spaceBelow / needHeight * 50) + 
                       (preferredPosition === 'bottom' ? 50 : 0)
            },
            { 
                position: 'top', 
                score: (spaceAbove >= needHeight ? 100 : spaceAbove / needHeight * 50) + 
                       (preferredPosition === 'top' ? 50 : 0)
            },
            { 
                position: 'right', 
                score: (spaceRight >= needWidth ? 90 : spaceRight / needWidth * 45) + 
                       (preferredPosition === 'right' ? 50 : 0)
            },
            { 
                position: 'left', 
                score: (spaceLeft >= needWidth ? 90 : spaceLeft / needWidth * 45) + 
                       (preferredPosition === 'left' ? 50 : 0)
            }
        ]
        
        // Sort by score descending
        positions.sort((a, b) => b.score - a.score)
        
        // Return the best position
        return positions[0].position
    }, [])
    
    // Calculate tooltip position style based on element and position
    const calculateTooltipStyle = useCallback((element: HTMLElement, position: 'top' | 'bottom' | 'left' | 'right'): React.CSSProperties => {
        const rect = element.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        
        let top = 0
        let left = 0
        
        switch (position) {
            case 'bottom':
                top = rect.bottom + GAP
                left = rect.left + rect.width / 2
                // Center horizontally, but keep within viewport
                left = Math.max(VIEWPORT_PADDING + TOOLTIP_WIDTH / 2, 
                               Math.min(left, viewportWidth - VIEWPORT_PADDING - TOOLTIP_WIDTH / 2))
                return {
                    top,
                    left,
                    transform: 'translateX(-50%)',
                    maxWidth: Math.min(TOOLTIP_WIDTH, viewportWidth - VIEWPORT_PADDING * 2)
                }
                
            case 'top':
                top = rect.top - GAP
                left = rect.left + rect.width / 2
                // Center horizontally, but keep within viewport
                left = Math.max(VIEWPORT_PADDING + TOOLTIP_WIDTH / 2, 
                               Math.min(left, viewportWidth - VIEWPORT_PADDING - TOOLTIP_WIDTH / 2))
                return {
                    top,
                    left,
                    transform: 'translate(-50%, -100%)',
                    maxWidth: Math.min(TOOLTIP_WIDTH, viewportWidth - VIEWPORT_PADDING * 2)
                }
                
            case 'right':
                top = rect.top + rect.height / 2
                left = rect.right + GAP
                // Center vertically, but keep within viewport
                top = Math.max(VIEWPORT_PADDING + TOOLTIP_HEIGHT / 2,
                              Math.min(top, viewportHeight - VIEWPORT_PADDING - TOOLTIP_HEIGHT / 2))
                return {
                    top,
                    left,
                    transform: 'translateY(-50%)',
                    maxWidth: Math.min(TOOLTIP_WIDTH, viewportWidth - left - VIEWPORT_PADDING)
                }
                
            case 'left':
                top = rect.top + rect.height / 2
                left = rect.left - GAP
                // Center vertically, but keep within viewport
                top = Math.max(VIEWPORT_PADDING + TOOLTIP_HEIGHT / 2,
                              Math.min(top, viewportHeight - VIEWPORT_PADDING - TOOLTIP_HEIGHT / 2))
                return {
                    top,
                    left,
                    transform: 'translate(-100%, -50%)',
                    maxWidth: Math.min(TOOLTIP_WIDTH, left - VIEWPORT_PADDING)
                }
        }
    }, [])
    
    // Update position using requestAnimationFrame for smooth performance
    const updatePosition = useCallback(() => {
        if (!targetElement || isCalculatingRef.current) return
        
        isCalculatingRef.current = true
        
        rafIdRef.current = requestAnimationFrame(() => {
            const step = tourSteps[currentStep]
            if (step) {
                const optimalPosition = calculateOptimalPosition(targetElement, step.position)
                setActualPosition(optimalPosition)
                setTooltipStyle(calculateTooltipStyle(targetElement, optimalPosition))
            }
            isCalculatingRef.current = false
        })
    }, [targetElement, currentStep, calculateOptimalPosition, calculateTooltipStyle])
    
    // Initialize and observe target element
    useEffect(() => {
        if (!showTour || currentStep >= tourSteps.length) {
            // Cleanup when tour is hidden
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect()
                resizeObserverRef.current = null
            }
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current)
                rafIdRef.current = null
            }
            return
        }
        
        const step = tourSteps[currentStep]
        const element = document.getElementById(step.targetId)
        
        if (element) {
            setTargetElement(element)
            
            // Initial position calculation
            updatePosition()
            
            // Scroll element into view if needed
            const rect = element.getBoundingClientRect()
            const isInViewport = rect.top >= 0 && rect.bottom <= window.innerHeight
            if (!isInViewport) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
            
            // Setup ResizeObserver for performant resize detection
            if (typeof ResizeObserver !== 'undefined') {
                resizeObserverRef.current = new ResizeObserver(() => {
                    updatePosition()
                })
                resizeObserverRef.current.observe(element)
                // Also observe document.body for overall layout changes
                resizeObserverRef.current.observe(document.body)
            }
        }
        
        return () => {
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect()
            }
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current)
            }
        }
    }, [showTour, currentStep, updatePosition])
    
    // Debounced scroll and window resize handlers
    useEffect(() => {
        if (!showTour || !targetElement) return
        
        const debouncedUpdate = debounce(updatePosition, 16) // ~60fps
        
        window.addEventListener('scroll', debouncedUpdate, { passive: true })
        window.addEventListener('resize', debouncedUpdate, { passive: true })
        
        return () => {
            window.removeEventListener('scroll', debouncedUpdate)
            window.removeEventListener('resize', debouncedUpdate)
        }
    }, [showTour, targetElement, updatePosition])
    
    // Handle escape key to close tour
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && showTour) {
                skipTour()
            }
        }
        
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [showTour, skipTour])
    
    // Handle backdrop click to close
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            skipTour()
        }
    }
    
    if (!showTour || currentStep >= tourSteps.length) {
        return null
    }
    
    const currentTourStep = tourSteps[currentStep]
    
    const handleNext = () => {
        if (currentStep === tourSteps.length - 1) {
            completeTour()
        } else {
            nextStep()
        }
    }
    
    return (
        <>
            {/* Backdrop - clickable to close */}
            <div 
                className="fixed inset-0 bg-black/50 z-40 animate-fade-in cursor-pointer" 
                onClick={handleBackdropClick}
                aria-label="Close tour"
            />
            
            {/* Highlight overlay - NOT clickable, allows clicking through to element */}
            {targetElement && (
                <div
                    className="fixed z-50 pointer-events-none transition-all duration-300"
                    style={{
                        top: targetElement.getBoundingClientRect().top - 8,
                        left: targetElement.getBoundingClientRect().left - 8,
                        width: targetElement.getBoundingClientRect().width + 16,
                        height: targetElement.getBoundingClientRect().height + 16,
                    }}
                >
                    <div className="w-full h-full rounded-2xl ring-4 ring-amber-400 ring-offset-4 ring-offset-transparent animate-pulse" />
                </div>
            )}
            
            {/* Tooltip */}
            {targetElement && (
                <div
                    className="fixed z-50 transition-all duration-300"
                    style={tooltipStyle}
                >
                    <TourTooltip
                        title={currentTourStep.title}
                        description={currentTourStep.description}
                        step={currentStep}
                        totalSteps={tourSteps.length}
                        onNext={handleNext}
                        onSkip={skipTour}
                        position={actualPosition}
                    />
                </div>
            )}
        </>
    )
}

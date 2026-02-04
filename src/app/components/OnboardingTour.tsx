'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import TourTooltip from './TourTooltip'
import { useOnboarding } from '@/app/hooks/useOnboarding'

interface TourStep {
    targetId: string | null  // null for splash screen
    title: string
    description: string
    position: 'top' | 'bottom' | 'left' | 'right'
    isSplash?: boolean
}

const tourSteps: TourStep[] = [
    {
        targetId: null,
        title: 'Welcome to trivrdy! 🎉',
        description: 'Your journey to Jeopardy mastery starts here. Take a quick tour to learn the ropes, or jump right in and start playing!',
        position: 'bottom',
        isSplash: true
    },
    {
        targetId: 'daily-challenge-card',
        title: 'Daily Challenge',
        description: 'Start each day with a fresh Final Jeopardy question and build your streak! Answer correctly to climb the leaderboard.',
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
        position: 'top'
    }
]

interface OnboardingTourProps {
    userId?: string | null
}

export default function OnboardingTour({ userId }: OnboardingTourProps) {
    const { showTour, currentStep, nextStep, skipTour, completeTour } = useOnboarding(userId)
    const [actualStep, setActualStep] = useState(0)
    
    const highlightRef = useRef<HTMLDivElement>(null)
    const tooltipRef = useRef<HTMLDivElement>(null)
    const targetRef = useRef<HTMLElement | null>(null)
    const rafId = useRef<number | null>(null)
    const scrollTimeout = useRef<NodeJS.Timeout | null>(null)
    
    // Tooltip dimensions
    const TOOLTIP_WIDTH = 340
    const TOOLTIP_HEIGHT = 220
    const GAP = 16
    const VIEWPORT_MARGIN = 20
    
    // Calculate position ensuring tooltip stays fully in viewport
    const calculateSafePosition = useCallback((targetRect: DOMRect, preferred: string) => {
        const vw = window.innerWidth
        const vh = window.innerHeight
        
        // Calculate available space
        const spaceTop = targetRect.top - VIEWPORT_MARGIN
        const spaceBottom = vh - targetRect.bottom - VIEWPORT_MARGIN
        const spaceLeft = targetRect.left - VIEWPORT_MARGIN
        const spaceRight = vw - targetRect.right - VIEWPORT_MARGIN
        
        const needHeight = TOOLTIP_HEIGHT + GAP
        const needWidth = TOOLTIP_WIDTH + GAP
        
        // Determine best position
        let position: 'top' | 'bottom' | 'left' | 'right'
        
        if (preferred === 'bottom' && spaceBottom >= needHeight) position = 'bottom'
        else if (preferred === 'top' && spaceTop >= needHeight) position = 'top'
        else if (spaceBottom >= needHeight) position = 'bottom'
        else if (spaceTop >= needHeight) position = 'top'
        else if (spaceRight >= needWidth) position = 'right'
        else if (spaceLeft >= needWidth) position = 'left'
        else position = 'bottom' // fallback
        
        // Calculate coordinates
        let x = 0
        let y = 0
        
        switch (position) {
            case 'bottom': {
                y = targetRect.bottom + GAP
                x = targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2
                // Clamp to viewport
                x = Math.max(VIEWPORT_MARGIN, Math.min(x, vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN))
                break
            }
            case 'top': {
                y = targetRect.top - GAP - TOOLTIP_HEIGHT
                x = targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2
                x = Math.max(VIEWPORT_MARGIN, Math.min(x, vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN))
                break
            }
            case 'right': {
                y = targetRect.top + targetRect.height / 2 - TOOLTIP_HEIGHT / 2
                x = targetRect.right + GAP
                y = Math.max(VIEWPORT_MARGIN, Math.min(y, vh - TOOLTIP_HEIGHT - VIEWPORT_MARGIN))
                break
            }
            case 'left': {
                y = targetRect.top + targetRect.height / 2 - TOOLTIP_HEIGHT / 2
                x = targetRect.left - GAP - TOOLTIP_WIDTH
                y = Math.max(VIEWPORT_MARGIN, Math.min(y, vh - TOOLTIP_HEIGHT - VIEWPORT_MARGIN))
                break
            }
        }
        
        return { x, y, position }
    }, [])
    
    // Update positions
    const updatePositions = useCallback(() => {
        const highlight = highlightRef.current
        const tooltip = tooltipRef.current
        const target = targetRef.current
        const step = tourSteps[actualStep]
        
        if (!tooltip) return
        
        // Handle splash screen (no highlight, centered at bottom)
        if (step.isSplash) {
            if (highlight) highlight.style.display = 'none'
            
            // Center at bottom of viewport
            const vw = window.innerWidth
            const vh = window.innerHeight
            const x = (vw - TOOLTIP_WIDTH) / 2
            const y = vh - TOOLTIP_HEIGHT - 100  // 100px from bottom
            
            tooltip.style.transform = `translate(${x}px, ${y}px)`
            tooltip.style.display = 'block'
            return
        }
        
        // Regular step with target
        if (!target || !highlight) return
        
        const rect = target.getBoundingClientRect()
        const pos = calculateSafePosition(rect, step.position)
        
        // Show and position highlight
        highlight.style.display = 'block'
        highlight.style.transform = `translate(${rect.left - 8}px, ${rect.top - 8}px)`
        highlight.style.width = `${rect.width + 16}px`
        highlight.style.height = `${rect.height + 16}px`
        
        // Position tooltip
        tooltip.style.display = 'block'
        tooltip.style.transform = `translate(${pos.x}px, ${pos.y}px)`
        tooltip.setAttribute('data-position', pos.position)
    }, [actualStep, calculateSafePosition])
    
    // Schedule update
    const scheduleUpdate = useCallback(() => {
        if (rafId.current) cancelAnimationFrame(rafId.current)
        rafId.current = requestAnimationFrame(updatePositions)
    }, [updatePositions])
    
    // Sync with onboarding hook
    useEffect(() => {
        setActualStep(currentStep)
    }, [currentStep])
    
    // Initialize step
    useEffect(() => {
        if (!showTour || actualStep >= tourSteps.length) return
        
        const step = tourSteps[actualStep]
        
        // Handle splash screen
        if (step.isSplash) {
            scheduleUpdate()
            return
        }
        
        // Handle regular step with target
        const element = document.getElementById(step.targetId!)
        if (element) {
            targetRef.current = element
            
            // Check if element is visible
            const rect = element.getBoundingClientRect()
            const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight
            
            if (!isVisible) {
                // Scroll to element
                element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                
                // Wait for scroll to complete, then update
                if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
                scrollTimeout.current = setTimeout(() => {
                    scheduleUpdate()
                }, 500)
            } else {
                scheduleUpdate()
            }
        }
        
        return () => {
            if (rafId.current) cancelAnimationFrame(rafId.current)
            if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
        }
    }, [showTour, actualStep, scheduleUpdate])
    
    // Scroll/resize handlers
    useEffect(() => {
        if (!showTour) return
        
        const handleScroll = () => scheduleUpdate()
        const handleResize = () => scheduleUpdate()
        
        window.addEventListener('scroll', handleScroll, { passive: true })
        window.addEventListener('resize', handleResize, { passive: true })
        
        return () => {
            window.removeEventListener('scroll', handleScroll)
            window.removeEventListener('resize', handleResize)
        }
    }, [showTour, scheduleUpdate])
    
    // Handle escape
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && showTour) skipTour()
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [showTour, skipTour])
    
    const handleNext = () => {
        if (actualStep === tourSteps.length - 1) {
            completeTour()
        } else {
            nextStep()
        }
    }
    
    if (!showTour || actualStep >= tourSteps.length) return null
    
    const step = tourSteps[actualStep]
    
    return (
        <>
            {/* Backdrop - darker outside, lighter inside highlight */}
            <div 
                className="fixed inset-0 bg-black/60 z-40 animate-fade-in" 
                onClick={() => skipTour()}
            />
            
            {/* Highlight overlay with lighter interior */}
            <div
                ref={highlightRef}
                className="fixed z-40 pointer-events-none hidden"
                style={{ top: 0, left: 0 }}
            >
                {/* Outer glow ring */}
                <div 
                    className="absolute -inset-2 rounded-3xl animate-pulse"
                    style={{
                        boxShadow: '0 0 0 4px #fbbf24, 0 0 20px 8px rgba(251, 191, 36, 0.5)'
                    }}
                />
                {/* Light inner area */}
                <div 
                    className="w-full h-full rounded-2xl"
                    style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'brightness(1.2)'
                    }}
                />
            </div>
            
            {/* Tooltip */}
            <div
                ref={tooltipRef}
                className="fixed z-50 hidden"
                style={{ 
                    top: 0, 
                    left: 0,
                    width: TOOLTIP_WIDTH
                }}
            >
                <TourTooltip
                    title={step.title}
                    description={step.description}
                    step={actualStep}
                    totalSteps={tourSteps.length}
                    onNext={handleNext}
                    onSkip={skipTour}
                    isSplash={step.isSplash}
                />
            </div>
        </>
    )
}

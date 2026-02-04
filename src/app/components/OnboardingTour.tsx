'use client'

import { useEffect, useState, useCallback } from 'react'
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
        position: 'bottom'
    }
]

export default function OnboardingTour() {
    const { showTour, currentStep, nextStep, skipTour, completeTour } = useOnboarding()
    const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
    const [actualPosition, setActualPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom')
    
    // Calculate smart position based on viewport space
    const calculatePosition = useCallback((element: HTMLElement, preferredPosition: 'top' | 'bottom' | 'left' | 'right') => {
        const rect = element.getBoundingClientRect()
        const viewportHeight = window.innerHeight
        const viewportWidth = window.innerWidth
        const tooltipHeight = 200 // Approximate tooltip height
        const tooltipWidth = 320 // Approximate tooltip width
        const gap = 16
        
        // Check if there's room below
        const spaceBelow = viewportHeight - rect.bottom - gap
        const spaceAbove = rect.top - gap
        
        if (preferredPosition === 'bottom' && spaceBelow < tooltipHeight && spaceAbove > tooltipHeight) {
            return 'top'
        }
        if (preferredPosition === 'top' && spaceAbove < tooltipHeight && spaceBelow > tooltipHeight) {
            return 'bottom'
        }
        
        return preferredPosition
    }, [])
    
    useEffect(() => {
        if (!showTour || currentStep >= tourSteps.length) {
            return
        }
        
        const step = tourSteps[currentStep]
        const element = document.getElementById(step.targetId)
        
        if (element) {
            setTargetElement(element)
            // Calculate smart position
            const smartPosition = calculatePosition(element, step.position)
            setActualPosition(smartPosition)
            
            // Scroll element into view with smooth behavior
            const scrollToElement = () => {
                const rect = element.getBoundingClientRect()
                const isInViewport = rect.top >= 0 && rect.bottom <= window.innerHeight
                
                if (!isInViewport) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
            }
            
            // Small delay to ensure DOM is ready
            setTimeout(scrollToElement, 100)
        }
    }, [showTour, currentStep, calculatePosition])
    
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
    
    // Handle scroll to update positions
    useEffect(() => {
        if (!showTour || !targetElement) return
        
        const handleScroll = () => {
            // Force re-render to update tooltip position
            setTargetElement(prev => prev)
        }
        
        window.addEventListener('scroll', handleScroll, { passive: true })
        window.addEventListener('resize', handleScroll, { passive: true })
        
        return () => {
            window.removeEventListener('scroll', handleScroll)
            window.removeEventListener('resize', handleScroll)
        }
    }, [showTour, targetElement])
    
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
                    style={{
                        top: actualPosition === 'bottom' 
                            ? targetElement.getBoundingClientRect().bottom + 16
                            : actualPosition === 'top'
                            ? targetElement.getBoundingClientRect().top - 16
                            : targetElement.getBoundingClientRect().top + targetElement.getBoundingClientRect().height / 2,
                        left: actualPosition === 'right'
                            ? targetElement.getBoundingClientRect().right + 16
                            : actualPosition === 'left'
                            ? targetElement.getBoundingClientRect().left - 16
                            : targetElement.getBoundingClientRect().left + targetElement.getBoundingClientRect().width / 2,
                        transform: actualPosition === 'bottom' || actualPosition === 'top'
                            ? 'translateX(-50%)'
                            : 'translateY(-50%)'
                    }}
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

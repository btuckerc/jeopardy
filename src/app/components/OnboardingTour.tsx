'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useOnboarding } from '@/app/hooks/useOnboarding'

interface TourStep {
    targetId: string | null
    title: string
    description: string
    position: 'top' | 'bottom' | 'left' | 'right'
    arrowPosition?: 'left' | 'center' | 'right'
    isBanner?: boolean
}

const tourSteps: TourStep[] = [
    {
        targetId: null,
        title: 'Welcome to trivrdy! 🎉',
        description: 'New here? Take a quick tour to learn the ropes! Or explore on your own.',
        position: 'bottom',
        isBanner: true
    },
    {
        targetId: 'daily-challenge-card',
        title: 'Daily Challenge',
        description: 'Start each day with a fresh Final Jeopardy question and build your streak!',
        position: 'bottom',
        arrowPosition: 'center'
    },
    {
        targetId: 'play-game-card',
        title: 'Play Full Games',
        description: 'Play complete Jeopardy games with Single, Double, and Final rounds.',
        position: 'right',
        arrowPosition: 'left'
    },
    {
        targetId: 'practice-card',
        title: 'Study Mode',
        description: 'Focus on specific categories or challenge yourself with triple stumpers.',
        position: 'left',
        arrowPosition: 'right'
    }
]

interface OnboardingTourProps {
    userId?: string | null
}

const isMobileDevice = () => {
    if (typeof window === 'undefined') return false
    const isMobileWidth = window.innerWidth < 768
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    return isMobileWidth || isMobileUA
}

export default function OnboardingTour({ userId }: OnboardingTourProps) {
    const { showTour, currentStep, nextStep, skipTour, completeTour } = useOnboarding(userId)
    const [actualStep, setActualStep] = useState(0)
    const [isMobile, setIsMobile] = useState(false)
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
    
    const tooltipRef = useRef<HTMLDivElement>(null)
    const rafId = useRef<number | null>(null)
    
    const TOOLTIP_WIDTH = 340
    const TOOLTIP_HEIGHT = 220
    const GAP = 16
    const VIEWPORT_MARGIN = 20
    
    useEffect(() => {
        const checkMobile = () => setIsMobile(isMobileDevice())
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])
    
    useEffect(() => {
        setActualStep(currentStep)
    }, [currentStep])
    
    // Find and track target element
    useEffect(() => {
        if (!showTour || isMobile || actualStep >= tourSteps.length) return
        
        const step = tourSteps[actualStep]
        
        if (step.isBanner) {
            setTargetRect(null)
            return
        }
        
        const findTarget = () => {
            const element = document.getElementById(step.targetId!)
            if (element) {
                const rect = element.getBoundingClientRect()
                setTargetRect(rect)
                
                const isVisible = rect.top >= 50 && rect.bottom <= window.innerHeight - 50
                if (!isVisible) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
            }
        }
        
        findTarget()
        const timer = setTimeout(findTarget, 100)
        
        return () => clearTimeout(timer)
    }, [showTour, isMobile, actualStep])
    
    // Update tooltip position
    useEffect(() => {
        if (!showTour || isMobile || actualStep >= tourSteps.length) return
        
        const step = tourSteps[actualStep]
        const tooltip = tooltipRef.current
        
        if (!tooltip || step.isBanner || !targetRect) return
        
        const vw = window.innerWidth
        const vh = window.innerHeight
        
        let x = 0
        let y = 0
        
        switch (step.position) {
            case 'bottom': {
                y = targetRect.bottom + GAP
                x = targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2
                x = Math.max(VIEWPORT_MARGIN, Math.min(x, vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN))
                tooltip.style.transform = `translate(${x}px, ${y}px)`
                break
            }
            case 'top': {
                y = targetRect.top - GAP - TOOLTIP_HEIGHT
                x = targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2
                x = Math.max(VIEWPORT_MARGIN, Math.min(x, vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN))
                tooltip.style.transform = `translate(${x}px, ${y}px)`
                break
            }
            case 'right': {
                x = targetRect.right + GAP
                y = targetRect.top + targetRect.height / 2 - TOOLTIP_HEIGHT / 2
                y = Math.max(VIEWPORT_MARGIN, Math.min(y, vh - TOOLTIP_HEIGHT - VIEWPORT_MARGIN))
                tooltip.style.transform = `translate(${x}px, ${y}px)`
                break
            }
            case 'left': {
                x = targetRect.left - GAP - TOOLTIP_WIDTH
                y = targetRect.top + targetRect.height / 2 - TOOLTIP_HEIGHT / 2
                y = Math.max(VIEWPORT_MARGIN, Math.min(y, vh - TOOLTIP_HEIGHT - VIEWPORT_MARGIN))
                tooltip.style.transform = `translate(${x}px, ${y}px)`
                break
            }
        }
    }, [showTour, isMobile, actualStep, targetRect])
    
    // Scroll and resize handler - combined for performance
    useEffect(() => {
        if (!showTour || isMobile) return
        
        const handleUpdate = () => {
            if (rafId.current) cancelAnimationFrame(rafId.current)
            rafId.current = requestAnimationFrame(() => {
                const step = tourSteps[actualStep]
                if (!step.isBanner && step.targetId) {
                    const element = document.getElementById(step.targetId)
                    if (element) {
                        setTargetRect(element.getBoundingClientRect())
                    }
                }
            })
        }
        
        window.addEventListener('scroll', handleUpdate, { passive: true })
        window.addEventListener('resize', handleUpdate, { passive: true })
        
        return () => {
            window.removeEventListener('scroll', handleUpdate)
            window.removeEventListener('resize', handleUpdate)
        }
    }, [showTour, isMobile, actualStep])
    
    // Handle escape
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && showTour && !isMobile) skipTour()
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [showTour, isMobile, skipTour])
    
    // Adjust footer padding based on banner height
    useEffect(() => {
        if (typeof window === 'undefined') return
        
        const footer = document.querySelector('footer')
        if (!footer) return
        
        const step = tourSteps[actualStep]
        
        if (step?.isBanner) {
            // Banner is approximately 80px tall (py-4 + content), add extra padding
            footer.style.paddingBottom = '120px'
            footer.style.transition = 'padding-bottom 0.3s ease-out'
        } else {
            // Reset to original padding
            footer.style.paddingBottom = ''
        }
        
        return () => {
            footer.style.paddingBottom = ''
        }
    }, [actualStep])
    
    const handleNext = () => {
        if (actualStep === tourSteps.length - 1) {
            completeTour()
        } else {
            nextStep()
        }
    }
    
    if (!showTour || isMobile || actualStep >= tourSteps.length) return null
    
    const step = tourSteps[actualStep]
    const isLastStep = actualStep === tourSteps.length - 1
    
    // Banner component
    if (step.isBanner) {
        return (
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-blue-900 border-t-4 border-amber-400 shadow-2xl">
                <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-1">{step.title}</h3>
                            <p className="text-blue-200 text-sm">{step.description}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <button onClick={() => skipTour()} className="text-blue-300 hover:text-white text-sm font-medium transition-colors whitespace-nowrap">
                                Dismiss
                            </button>
                            <button onClick={handleNext} className="bg-amber-400 hover:bg-amber-500 text-blue-900 px-5 py-2 rounded-lg font-bold text-sm transition-colors whitespace-nowrap">
                                Take Tour →
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
    
    const highlightStyle = targetRect ? {
        top: targetRect.top - 8,
        left: targetRect.left - 8,
        width: targetRect.width + 16,
        height: targetRect.height + 16,
    } : null
    
    return (
        <>
            {/* Dark backdrop with rounded transparent hole using mask - click-through enabled */}
            {highlightStyle && (
                <div 
                    className="fixed inset-0 z-40 animate-fade-in pointer-events-none"
                    style={{
                        background: 'rgba(0, 0, 0, 0.6)',
                        maskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'%3E%3Cdefs%3E%3Cmask id='hole'%3E%3Crect width='100%25' height='100%25' fill='white'/%3E%3Crect x='${highlightStyle.left}' y='${highlightStyle.top}' width='${highlightStyle.width}' height='${highlightStyle.height}' rx='16' ry='16' fill='black'/%3E%3C/mask%3E%3C/defs%3E%3Crect width='100%25' height='100%25' mask='url(%23hole)' fill='black'/%3E%3C/svg%3E")`,
                        WebkitMaskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'%3E%3Cdefs%3E%3Cmask id='hole'%3E%3Crect width='100%25' height='100%25' fill='white'/%3E%3Crect x='${highlightStyle.left}' y='${highlightStyle.top}' width='${highlightStyle.width}' height='${highlightStyle.height}' rx='16' ry='16' fill='black'/%3E%3C/mask%3E%3C/defs%3E%3Crect width='100%25' height='100%25' mask='url(%23hole)' fill='black'/%3E%3C/svg%3E")`,
                    }}
                />
            )}
            
            {/* Amber glow ring around target */}
            {highlightStyle && (
                <div
                    className="fixed z-50 pointer-events-none"
                    style={{
                        top: highlightStyle.top,
                        left: highlightStyle.left,
                        width: highlightStyle.width,
                        height: highlightStyle.height,
                        boxShadow: '0 0 0 4px #fbbf24, 0 0 20px 8px rgba(251, 191, 36, 0.6)',
                        borderRadius: '16px',
                    }}
                />
            )}
            
            {/* Tooltip */}
            <div
                ref={tooltipRef}
                className="fixed z-50"
                style={{ 
                    top: 0, 
                    left: 0, 
                    width: TOOLTIP_WIDTH,
                    transform: targetRect ? undefined : 'translate(-9999px, -9999px)'
                }}
            >
                {/* Arrow - Traditional CSS border triangle speech bubble approach */}
                <div 
                    className="absolute"
                    style={{
                        width: 0,
                        height: 0,
                        zIndex: 1,
                        // Position based on tooltip placement
                        ...(step.position === 'bottom' && {
                            top: '-12px',
                            left: step.arrowPosition === 'center' || !step.arrowPosition ? '50%' : step.arrowPosition === 'left' ? '32px' : 'auto',
                            right: step.arrowPosition === 'right' ? '32px' : 'auto',
                            transform: step.arrowPosition === 'center' || !step.arrowPosition ? 'translateX(-50%)' : 'none',
                            borderLeft: '12px solid transparent',
                            borderRight: '12px solid transparent',
                            borderBottom: '12px solid white',
                            filter: 'drop-shadow(0 -2px 2px rgba(0,0,0,0.1))'
                        }),
                        ...(step.position === 'top' && {
                            bottom: '-12px',
                            left: step.arrowPosition === 'center' || !step.arrowPosition ? '50%' : step.arrowPosition === 'left' ? '32px' : 'auto',
                            right: step.arrowPosition === 'right' ? '32px' : 'auto',
                            transform: step.arrowPosition === 'center' || !step.arrowPosition ? 'translateX(-50%)' : 'none',
                            borderLeft: '12px solid transparent',
                            borderRight: '12px solid transparent',
                            borderTop: '12px solid white',
                            filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.1))'
                        }),
                        ...(step.position === 'right' && {
                            left: '-12px',
                            top: step.arrowPosition === 'center' || !step.arrowPosition ? '50%' : '24px',
                            transform: step.arrowPosition === 'center' || !step.arrowPosition ? 'translateY(-50%)' : 'none',
                            borderTop: '12px solid transparent',
                            borderBottom: '12px solid transparent',
                            borderRight: '12px solid white',
                            filter: 'drop-shadow(-2px 0 2px rgba(0,0,0,0.1))'
                        }),
                        ...(step.position === 'left' && {
                            right: '-12px',
                            top: step.arrowPosition === 'center' || !step.arrowPosition ? '50%' : '24px',
                            transform: step.arrowPosition === 'center' || !step.arrowPosition ? 'translateY(-50%)' : 'none',
                            borderTop: '12px solid transparent',
                            borderBottom: '12px solid transparent',
                            borderLeft: '12px solid white',
                            filter: 'drop-shadow(2px 0 2px rgba(0,0,0,0.1))'
                        })
                    }}
                />
                
                <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200 p-6 animate-fade-in-up" style={{ zIndex: 2 }}>
                    {/* X Close button */}
                    <button
                        onClick={() => skipTour()}
                        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors p-1"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    
                    {/* Progress */}
                    <div className="flex items-center gap-1 mb-4">
                        {tourSteps.slice(1).map((_, i) => (
                            <div
                                key={i}
                                className={`w-2 h-2 rounded-full ${i < actualStep ? 'bg-amber-400' : 'bg-gray-300'}`}
                            />
                        ))}
                        <span className="text-xs text-gray-500 ml-2">{actualStep} of {tourSteps.length - 1}</span>
                    </div>
                    
                    {/* Content */}
                    <h3 className="text-xl font-bold text-gray-900 mb-2 pr-6">{step.title}</h3>
                    <p className="text-gray-600 text-sm mb-6 leading-relaxed">{step.description}</p>
                    
                    {/* Actions */}
                    <div className="flex items-center justify-between">
                        <button onClick={() => skipTour()} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
                            Skip Tour
                        </button>
                        <button onClick={handleNext} className="bg-amber-400 hover:bg-amber-500 text-blue-900 px-5 py-2.5 rounded-lg font-bold text-sm">
                            {isLastStep ? 'Finish' : 'Next →'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}

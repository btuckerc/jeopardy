'use client'

import { useState, useEffect, useCallback } from 'react'

interface TourState {
    hasSeenTour: boolean
    tourCompleted: boolean
    tourDismissed: boolean
    tourDismissedAt: string | null
}

interface OnboardingState {
    isComplete: boolean
    currentStep: number
    showTour: boolean
    isLoading: boolean
}

export function useOnboarding(userId?: string | null, initialTourState?: TourState | null) {
    const [state, setState] = useState<OnboardingState>(() => {
        // If we have initial state from server, use it immediately (no loading, no flash)
        if (initialTourState) {
            const shouldShowTour = !initialTourState.tourCompleted && !initialTourState.tourDismissed
            return {
                isComplete: initialTourState.tourCompleted || initialTourState.tourDismissed,
                currentStep: 0,
                showTour: shouldShowTour,
                isLoading: false
            }
        }
        
        // If no user or no initial state, default to not showing tour
        if (!userId) {
            return {
                isComplete: true,
                currentStep: 0,
                showTour: false,
                isLoading: false
            }
        }
        
        // Loading state only if we need to fetch client-side (shouldn't happen with server rendering)
        return {
            isComplete: true,
            currentStep: 0,
            showTour: false,
            isLoading: true
        }
    })
    
    // Only fetch client-side if we don't have initial state (fallback for client-side navigation)
    useEffect(() => {
        // Skip if we already have initial state from server
        if (initialTourState || !userId) {
            return
        }
        
        const fetchTourState = async () => {
            try {
                const response = await fetch('/api/user/tour-state')
                if (!response.ok) {
                    // If API fails, default to not showing tour
                    setState({
                        isComplete: true,
                        currentStep: 0,
                        showTour: false,
                        isLoading: false
                    })
                    return
                }
                
                const data: TourState = await response.json()
                
                // Show tour if not completed and not dismissed
                const shouldShowTour = !data.tourCompleted && !data.tourDismissed
                
                setState({
                    isComplete: data.tourCompleted || data.tourDismissed,
                    currentStep: 0,
                    showTour: shouldShowTour,
                    isLoading: false
                })
            } catch (error) {
                // On error, default to not showing tour
                setState({
                    isComplete: true,
                    currentStep: 0,
                    showTour: false,
                    isLoading: false
                })
            }
        }
        
        fetchTourState()
    }, [userId, initialTourState])
    
    const nextStep = useCallback(() => {
        setState(prev => ({
            ...prev,
            currentStep: prev.currentStep + 1
        }))
    }, [])
    
    const skipTour = useCallback(async () => {
        try {
            await fetch('/api/user/tour-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'dismiss' })
            })
        } catch (error) {
            console.error('Failed to update tour state:', error)
        }
        
        setState(prev => ({
            ...prev,
            isComplete: true,
            showTour: false
        }))
    }, [])
    
    const completeTour = useCallback(async () => {
        try {
            await fetch('/api/user/tour-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'complete' })
            })
        } catch (error) {
            console.error('Failed to update tour state:', error)
        }
        
        setState(prev => ({
            ...prev,
            isComplete: true,
            showTour: false
        }))
    }, [])
    
    const startTour = useCallback(async () => {
        try {
            await fetch('/api/user/tour-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start' })
            })
        } catch (error) {
            console.error('Failed to update tour state:', error)
        }
        
        setState(prev => ({
            ...prev,
            hasSeenTour: true
        }))
    }, [])
    
    const restartTour = useCallback(async () => {
        try {
            await fetch('/api/user/tour-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start' })
            })
        } catch (error) {
            console.error('Failed to restart tour:', error)
        }
        
        setState({
            isComplete: false,
            currentStep: 0,
            showTour: true,
            isLoading: false
        })
    }, [])
    
    return {
        ...state,
        nextStep,
        skipTour,
        completeTour,
        restartTour
    }
}

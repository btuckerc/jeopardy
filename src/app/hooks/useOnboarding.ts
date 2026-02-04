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

export function useOnboarding(userId?: string | null) {
    const [state, setState] = useState<OnboardingState>({
        isComplete: true,
        currentStep: 0,
        showTour: false,
        isLoading: true
    })
    
    // Fetch tour state from server
    useEffect(() => {
        if (!userId) {
            setState(prev => ({ ...prev, isLoading: false }))
            return
        }
        
        const fetchTourState = async () => {
            try {
                const response = await fetch('/api/user/tour-state')
                if (!response.ok) {
                    // If API fails, default to showing tour
                    setState({
                        isComplete: false,
                        currentStep: 0,
                        showTour: true,
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
                // On error, default to showing tour
                setState({
                    isComplete: false,
                    currentStep: 0,
                    showTour: true,
                    isLoading: false
                })
            }
        }
        
        fetchTourState()
    }, [userId])
    
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

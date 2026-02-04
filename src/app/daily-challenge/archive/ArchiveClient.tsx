'use client'

import { useState, useEffect } from 'react'
import ArchiveCalendar from '../components/ArchiveCalendar'
import ArchiveDayDetail from '../components/ArchiveDayDetail'
import toast from 'react-hot-toast'

interface ArchiveDay {
    id: string
    date: string
    question: {
        id: string
        question: string
        answer: string
        category: string
        airDate: string | null
    }
    participation: {
        correct: boolean
        completedAt: string
        userAnswerText: string | null
    } | null
}

export default function ArchiveClient() {
    const [challenges, setChallenges] = useState<ArchiveDay[]>([])
    const [activeDate, setActiveDate] = useState<string>('')
    const [selectedDay, setSelectedDay] = useState<ArchiveDay | null>(null)
    const [loading, setLoading] = useState(true)
    
    useEffect(() => {
        loadArchive()
    }, [])
    
    const loadArchive = async () => {
        try {
            const response = await fetch('/api/daily-challenge/archive')
            if (!response.ok) {
                throw new Error('Failed to load archive')
            }
            
            const data = await response.json()
            setChallenges(data.challenges)
            setActiveDate(data.activeDate)
        } catch (error) {
            console.error('Error loading archive:', error)
            toast.error('Failed to load daily challenge archive')
        } finally {
            setLoading(false)
        }
    }
    
    const handleSelectDay = (day: ArchiveDay) => {
        setSelectedDay(day)
    }
    
    const handleBack = () => {
        setSelectedDay(null)
    }
    
    const handleParticipationUpdate = (challengeId: string, participation: {
        correct: boolean
        completedAt: string
        userAnswerText: string | null
    }) => {
        // Update the challenges list with new participation data
        setChallenges(prev => prev.map(challenge => {
            if (challenge.id === challengeId) {
                return {
                    ...challenge,
                    participation
                }
            }
            return challenge
        }))
        
        // Update selected day if it's the one being modified
        if (selectedDay && selectedDay.id === challengeId) {
            setSelectedDay({
                ...selectedDay,
                participation
            })
        }
    }
    
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-amber-400 border-r-transparent" />
            </div>
        )
    }
    
    if (challenges.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-blue-200 text-lg">No challenges available in the archive.</p>
            </div>
        )
    }
    
    return (
        <div className="bg-blue-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-blue-700/50 p-6 sm:p-8">
            {selectedDay ? (
                <ArchiveDayDetail
                    day={selectedDay}
                    onBack={handleBack}
                    onParticipationUpdate={handleParticipationUpdate}
                />
            ) : (
                <ArchiveCalendar
                    challenges={challenges}
                    activeDate={activeDate}
                    onSelectDay={handleSelectDay}
                />
            )}
        </div>
    )
}

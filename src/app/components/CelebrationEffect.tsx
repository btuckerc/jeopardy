'use client'

import { useEffect, useState } from 'react'

interface CelebrationEffectProps {
    isActive: boolean
    onComplete?: () => void
}

export default function CelebrationEffect({ isActive, onComplete }: CelebrationEffectProps) {
    const [particles, setParticles] = useState<Array<{
        id: number
        x: number
        y: number
        color: string
        delay: number
    }>>([])

    useEffect(() => {
        if (isActive) {
            // Generate particles
            const newParticles = Array.from({ length: 50 }, (_, i) => ({
                id: i,
                x: Math.random() * 100,
                y: Math.random() * 100,
                color: ['#FFD700', '#FFA500', '#FF6347', '#4169E1', '#32CD32'][Math.floor(Math.random() * 5)],
                delay: Math.random() * 0.5
            }))
            setParticles(newParticles)

            // Cleanup after animation
            const timer = setTimeout(() => {
                setParticles([])
                onComplete?.()
            }, 3000)

            return () => clearTimeout(timer)
        }
    }, [isActive, onComplete])

    if (!isActive || particles.length === 0) {
        return null
    }

    return (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {particles.map((particle) => (
                <div
                    key={particle.id}
                    className="absolute w-3 h-3 rounded-full animate-celebrate"
                    style={{
                        left: `${particle.x}%`,
                        top: `${particle.y}%`,
                        backgroundColor: particle.color,
                        animationDelay: `${particle.delay}s`,
                        transform: `translate(-50%, -50%)`
                    }}
                />
            ))}
        </div>
    )
}

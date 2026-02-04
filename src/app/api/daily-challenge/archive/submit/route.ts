import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkAndUnlockAchievements } from '@/lib/achievements'
import { getQuestionOverrides, isAnswerAcceptedWithOverrides } from '@/lib/answer-overrides'
import { getGuestConfig, createGuestSession } from '@/lib/guest-sessions'
import { getActiveChallengeDate } from '@/lib/daily-challenge-utils'

const submitSchema = z.object({
    challengeId: z.string(),
    answer: z.string().min(1)
})

/**
 * POST /api/daily-challenge/archive/submit
 * Submit an answer for an archived daily challenge (within 7-day window)
 */
export const POST = withInstrumentation(async (request: NextRequest) => {
    try {
        const body = await request.json()
        const { challengeId, answer } = submitSchema.parse(body)
        
        // Get user (or null for guest)
        const user = await getAppUser()
        
        // Get guest config
        const guestConfig = await getGuestConfig()
        
        // Check if guest participation is allowed
        if (!user && !guestConfig.dailyChallengeGuestEnabled) {
            return jsonResponse({ 
                error: 'Sign in required',
                requiresAuth: true 
            }, 403)
        }
        
        // Fetch the challenge
        const challenge = await prisma.dailyChallenge.findUnique({
            where: { id: challengeId },
            include: {
                question: {
                    include: {
                        category: true
                    }
                }
            }
        })
        
        if (!challenge) {
            return jsonResponse({ error: 'Challenge not found' }, 404)
        }
        
        // Validate the challenge is within the 7-day window
        const activeDate = getActiveChallengeDate()
        const sevenDaysAgo = new Date(activeDate)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
        
        const challengeDate = new Date(challenge.date)
        if (challengeDate < sevenDaysAgo || challengeDate > activeDate) {
            return jsonResponse({ 
                error: 'Challenge is outside the 7-day archive window' 
            }, 400)
        }
        
        // Check if user already participated
        let existingParticipation = null
        if (user) {
            existingParticipation = await prisma.userDailyChallenge.findUnique({
                where: {
                    userId_challengeId: {
                        userId: user.id,
                        challengeId: challenge.id
                    }
                }
            })
        }
        
        // If already participated, return existing result
        if (existingParticipation) {
            return jsonResponse({
                correct: existingParticipation.correct,
                alreadyCompleted: true,
                unlockedAchievements: []
            })
        }
        
        // Grade the answer
        const overrides = await getQuestionOverrides(challenge.question.id)
        const isCorrect = isAnswerAcceptedWithOverrides(
            answer.trim(),
            challenge.question.answer,
            overrides
        )
        
        // Save participation
        let guestSessionId: string | undefined
        
        if (user) {
            // Save for authenticated user
            await prisma.userDailyChallenge.create({
                data: {
                    userId: user.id,
                    challengeId: challenge.id,
                    correct: isCorrect,
                    completedAt: new Date(),
                    userAnswer: answer.trim()
                }
            })
            
            // Check for achievements
            const unlockedAchievements = await checkAndUnlockAchievements(user.id, {
                type: 'daily_challenge_completed',
                data: { challengeId: challenge.id, correct: isCorrect }
            })
            
            return jsonResponse({
                correct: isCorrect,
                unlockedAchievements
            })
        } else {
            // Create guest session
            const guestSession = await createGuestSession('DAILY_CHALLENGE')
            guestSessionId = guestSession.id
            
            // Guest participation is stored in the session data for later claim
            
            return jsonResponse({
                correct: isCorrect,
                guestSessionId
            })
        }
    } catch (error) {
        console.error('Error submitting archived challenge answer:', error)
        if (error instanceof z.ZodError) {
            return jsonResponse({ error: 'Invalid request data' }, 400)
        }
        return jsonResponse({ error: 'Failed to submit answer' }, 500)
    }
})

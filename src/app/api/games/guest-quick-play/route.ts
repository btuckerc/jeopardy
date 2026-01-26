import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { jsonResponse, serverErrorResponse } from '@/lib/api-utils'
import { nanoid } from 'nanoid'
import { createGuestSession, getGuestConfig } from '@/lib/guest-sessions'

/**
 * POST /api/games/guest-quick-play
 * Create a random guest game immediately with default settings (no auth required)
 */
export async function POST(_request: Request) {
    try {
        const _guestConfig = await getGuestConfig()
        
        // Check if guest games are allowed (for now, always allow if we have config)
        // In the future, we could add a flag like dailyChallengeGuestEnabled

        // Default spoiler protection (no user-specific settings for guests)
        const spoilerProtection = { enabled: false, cutoffDate: null }

        // Generate a unique seed
        const seed = nanoid(10)

        // Default game configuration: random mode, all rounds
        const gameConfigToStore = {
            mode: 'random',
            rounds: {
                single: true,
                double: true,
                final: false
            },
            spoilerProtection
        } as unknown as Prisma.InputJsonValue

        // Create guest session first
        const session = await createGuestSession('RANDOM_GAME', {
            seed,
            config: gameConfigToStore
        })

        // Create the guest game
        const guestGame = await prisma.guestGame.create({
            data: {
                guestSessionId: session.id,
                seed,
                config: gameConfigToStore,
                status: 'IN_PROGRESS',
                currentRound: 'SINGLE',
                currentScore: 0
            }
        })

        return jsonResponse({
            guestSessionId: session.id,
            guestGameId: guestGame.id,
            seed: guestGame.seed,
            status: guestGame.status,
            currentRound: guestGame.currentRound,
            expiresAt: session.expiresAt.toISOString()
        }, 201)
    } catch (error) {
        return serverErrorResponse('Failed to create guest quick play game', error)
    }
}


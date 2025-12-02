import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils'
import { nanoid } from 'nanoid'
import { computeUserEffectiveCutoff, toStoredPolicy, type StoredSpoilerPolicy } from '@/lib/spoiler-utils'

/**
 * POST /api/games/quick-play
 * Create a random game immediately with default settings (no configuration needed)
 */
export async function POST(request: Request) {
    try {
        const appUser = await getAppUser()

        if (!appUser) {
            return unauthorizedResponse()
        }

        // Use user's current spoiler settings
        const userPolicy = await computeUserEffectiveCutoff(appUser.id)
        const spoilerProtection = toStoredPolicy(userPolicy)

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

        // Create the game
        const game = await prisma.game.create({
            data: {
                userId: appUser.id,
                seed,
                config: gameConfigToStore,
                status: 'IN_PROGRESS',
                currentRound: 'SINGLE',
                currentScore: 0,
                visibility: 'PRIVATE',
                useKnowledgeCategories: false
            }
        })

        return jsonResponse({
            id: game.id,
            seed: game.seed,
            status: game.status,
            currentRound: game.currentRound
        }, 201)
    } catch (error) {
        return serverErrorResponse('Failed to create quick play game', error)
    }
}


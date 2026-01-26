import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, notFoundResponse, serverErrorResponse } from '@/lib/api-utils'
import { nanoid } from 'nanoid'
import { computeUserEffectiveCutoff, toStoredPolicy } from '@/lib/spoiler-utils'

interface RouteParams {
    params: Promise<{ seed: string }>
}

/**
 * GET /api/games/by-seed/[seed]
 * Look up a game configuration by its seed.
 * Returns the config so a user can preview before starting their own game.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { seed } = await params

        // Find the original game by seed
        const originalGame = await prisma.game.findFirst({
            where: { seed },
            select: {
                id: true,
                seed: true,
                config: true,
                createdAt: true,
                user: {
                    select: {
                        displayName: true
                    }
                }
            }
        })

        if (!originalGame) {
            return notFoundResponse('No game found with this seed')
        }

        const config = originalGame.config as Record<string, unknown> | null

        // Generate a human-readable label for the game
        let label = 'Game'
        if (config?.mode === 'random') {
            label = 'Random Categories'
        } else if (config?.mode === 'knowledge') {
            const areas = (config.categories as string[] | undefined) || []
            if (areas.length === 1) {
                label = areas[0].replace(/_/g, ' ')
            } else if (areas.length > 1) {
                label = `${areas.length} Knowledge Areas`
            }
        } else if (config?.mode === 'custom') {
            const catIds = config.categoryIds as string[] | undefined
            const catCount = catIds?.length || 0
            label = `Custom (${catCount} categories)`
        } else if (config?.mode === 'date' && config.date) {
            const dateStr = config.date as string
            const [year, month, day] = dateStr.split('-').map(Number)
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            label = `Episode: ${months[month - 1]} ${day}, ${year}`
        }

        // Determine rounds info
        const rounds = (config?.rounds as { single?: boolean; double?: boolean; final?: boolean } | undefined) || { single: true, double: true, final: false }
        const roundsList: string[] = []
        if (rounds.single) roundsList.push('Single Jeopardy')
        if (rounds.double) roundsList.push('Double Jeopardy')
        if (rounds.final) roundsList.push('Final Jeopardy')

        return jsonResponse({
            seed: originalGame.seed,
            label,
            mode: config?.mode,
            rounds: roundsList,
            createdBy: originalGame.user?.displayName || 'Anonymous',
            createdAt: originalGame.createdAt
        })
    } catch (error) {
        return serverErrorResponse('Failed to look up game', error)
    }
}

/**
 * POST /api/games/by-seed/[seed]
 * Create a new game using the configuration from an existing seed.
 * The new game will have its own unique ID but use the same config.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const appUser = await getAppUser()

        if (!appUser) {
            return unauthorizedResponse()
        }

        const { seed } = await params

        // Find the original game by seed
        const originalGame = await prisma.game.findFirst({
            where: { seed },
            select: {
                config: true
            }
        })

        if (!originalGame) {
            return notFoundResponse('No game found with this seed')
        }

        const config = originalGame.config as Record<string, unknown> | null

        // Determine starting round
        const rounds = (config?.rounds as { single?: boolean; double?: boolean; final?: boolean } | undefined) || { single: true, double: true, final: false }
        const startingRound = rounds.single ? 'SINGLE' : rounds.double ? 'DOUBLE' : 'SINGLE'

        // Generate a new seed for this player's game
        const newSeed = nanoid(10)

        // Compute the spoiler protection policy for this new game instance.
        // Each player gets their own Game row (for now), so we compute the policy
        // based on the joining user's current profile settings.
        //
        // NOTE: When we move to a true shared Game with opponentUserId,
        // we will instead compute spoilerProtection from ALL participants'
        // profiles once and keep it fixed for the entire game.
        const userPolicy = await computeUserEffectiveCutoff(appUser.id)
        const spoilerProtection = toStoredPolicy(userPolicy)

        // Build JSON-safe game configuration to store
        const gameConfigToStore = {
            ...config,
            // Store reference to original seed for tracking
            originalSeed: seed,
            // Use the joining user's spoiler protection policy
            // This replaces any spoilerProtection from the original game
            spoilerProtection
        } as unknown as Prisma.InputJsonValue

        // Create a new game with the same config but the new user's spoiler policy
        const newGame = await prisma.game.create({
            data: {
                userId: appUser.id,
                seed: newSeed,
                config: gameConfigToStore,
                status: 'IN_PROGRESS',
                currentRound: startingRound,
                currentScore: 0,
                visibility: 'PRIVATE',
                useKnowledgeCategories: config?.mode === 'knowledge'
            }
        })

        return jsonResponse({
            id: newGame.id,
            seed: newGame.seed,
            status: newGame.status,
            currentRound: newGame.currentRound,
            config: newGame.config
        }, 201)
    } catch (error) {
        return serverErrorResponse('Failed to create game from seed', error)
    }
}


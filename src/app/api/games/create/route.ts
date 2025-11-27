import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse, parseBody, badRequestResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { computeUserEffectiveCutoff, toStoredPolicy, type StoredSpoilerPolicy } from '@/lib/spoiler-utils'

// Schema for game configuration
const gameConfigSchema = z.object({
    mode: z.enum(['random', 'knowledge', 'custom', 'date']),
    categories: z.array(z.string()).optional(), // Knowledge categories
    categoryIds: z.array(z.string()).optional(), // Custom category IDs
    date: z.string().optional(), // Air date for date mode
    rounds: z.object({
        single: z.boolean().default(true),
        double: z.boolean().default(true),
        final: z.boolean().default(false)
    }).optional(),
    finalCategoryMode: z.enum(['shuffle', 'byDate', 'specificCategory']).optional(),
    finalCategoryId: z.string().optional(),
    // Spoiler override options - allows user to explicitly override their spoiler settings for this game
    overrideSpoilerCutoff: z.string().optional(), // ISO date string - use this as the cutoff instead of user's profile
    ignoreSpoilerCutoff: z.boolean().optional() // If true, disable spoiler protection for this game
})

/**
 * POST /api/games/create
 * Create a new game with the given configuration.
 * Returns the game ID and seed for sharing.
 */
export async function POST(request: Request) {
    try {
        const appUser = await getAppUser()

        if (!appUser) {
            return unauthorizedResponse()
        }

        const { data: config, error } = await parseBody(request, gameConfigSchema)
        if (error) return error

        // Validate mode-specific requirements
        if (config.mode === 'knowledge' && (!config.categories || config.categories.length === 0)) {
            return badRequestResponse('Knowledge mode requires at least one knowledge category')
        }
        if (config.mode === 'custom' && (!config.categoryIds || config.categoryIds.length === 0)) {
            return badRequestResponse('Custom mode requires at least one category')
        }
        if (config.mode === 'date' && !config.date) {
            return badRequestResponse('Date mode requires a date')
        }

        // Validate rounds - at least one must be selected
        const rounds = config.rounds || { single: true, double: true, final: false }
        if (!rounds.single && !rounds.double && !rounds.final) {
            return badRequestResponse('At least one round must be selected')
        }

        // Compute the spoiler protection policy for this game
        // This captures the user's spoiler settings at game creation time,
        // ensuring consistent behavior even if they change their profile later.
        let spoilerProtection: StoredSpoilerPolicy

        if (config.ignoreSpoilerCutoff) {
            // User explicitly chose to disable spoiler protection for this game
            spoilerProtection = { enabled: false, cutoffDate: null }
        } else if (config.overrideSpoilerCutoff) {
            // User explicitly chose a different cutoff date for this game
            spoilerProtection = { enabled: true, cutoffDate: config.overrideSpoilerCutoff }
        } else {
            // Use the user's current profile spoiler settings
            const userPolicy = await computeUserEffectiveCutoff(appUser.id)
            spoilerProtection = toStoredPolicy(userPolicy)
        }

        // Generate a unique seed for this game configuration
        // The seed is a short, URL-safe identifier that can be used to recreate the game
        const seed = nanoid(10)

        // Determine starting round
        const startingRound = rounds.single ? 'SINGLE' : rounds.double ? 'DOUBLE' : 'SINGLE'

        // Build JSON-safe game configuration to store
        const gameConfigToStore = {
            mode: config.mode,
            categories: config.categories,
            categoryIds: config.categoryIds,
            date: config.date,
            rounds,
            finalCategoryMode: config.finalCategoryMode,
            finalCategoryId: config.finalCategoryId,
            spoilerProtection
        } as unknown as Prisma.InputJsonValue

        // Create the game
        const game = await prisma.game.create({
            data: {
                userId: appUser.id,
                seed,
                config: gameConfigToStore,
                status: 'IN_PROGRESS',
                currentRound: startingRound,
                currentScore: 0,
                visibility: 'PRIVATE',
                useKnowledgeCategories: config.mode === 'knowledge'
            }
        })

        return jsonResponse({
            id: game.id,
            seed: game.seed,
            status: game.status,
            currentRound: game.currentRound,
            config: game.config
        }, 201)
    } catch (error) {
        return serverErrorResponse('Failed to create game', error)
    }
}

/**
 * Spoiler protection utilities for Jeopardy games.
 * 
 * Provides centralized logic for computing effective spoiler policies
 * from one or more users and generating Prisma-compatible filters.
 */

import { prisma } from './prisma'
import { startOfDay } from 'date-fns'
import type { Prisma } from '@prisma/client'

/**
 * Represents an effective spoiler policy, either from a single user
 * or computed from multiple participants.
 */
export interface SpoilerPolicy {
    /** Whether spoiler protection is active */
    enabled: boolean
    /** The cutoff date - questions with airDate >= this date are blocked */
    cutoffDate: Date | null
}

/**
 * Represents a spoiler policy as stored in Game.config.
 * Uses ISO string for JSON serialization.
 */
export interface StoredSpoilerPolicy {
    enabled: boolean
    cutoffDate: string | null // ISO date string
}

/**
 * Load a single user's spoiler settings from the database.
 */
export async function getUserSpoilerSettings(userId: string): Promise<{
    spoilerBlockEnabled: boolean
    spoilerBlockDate: Date | null
}> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            spoilerBlockEnabled: true,
            spoilerBlockDate: true
        }
    })

    return {
        spoilerBlockEnabled: user?.spoilerBlockEnabled ?? false,
        spoilerBlockDate: user?.spoilerBlockDate ?? null
    }
}

/**
 * Compute the effective spoiler policy for a single user.
 * 
 * If the user has spoiler protection enabled but no date set,
 * we default to the start of today (matching existing behavior).
 */
export async function computeUserEffectiveCutoff(userId: string): Promise<SpoilerPolicy> {
    const settings = await getUserSpoilerSettings(userId)

    if (!settings.spoilerBlockEnabled) {
        return { enabled: false, cutoffDate: null }
    }

    // If enabled but no date, default to start of today
    const cutoffDate = settings.spoilerBlockDate ?? startOfDay(new Date())

    return {
        enabled: true,
        cutoffDate
    }
}

/**
 * Compute the combined spoiler policy for multiple users.
 * 
 * Rules:
 * - enabled is true if ANY user has spoiler protection enabled
 * - cutoffDate is the EARLIEST date among all enabled users
 *   (most restrictive policy wins)
 * 
 * This ensures no participant sees questions that would violate
 * their spoiler settings.
 */
export async function computeCombinedSpoilerPolicy(userIds: string[]): Promise<SpoilerPolicy> {
    if (userIds.length === 0) {
        return { enabled: false, cutoffDate: null }
    }

    // Load all users' settings in parallel
    const settingsPromises = userIds.map(id => getUserSpoilerSettings(id))
    const allSettings = await Promise.all(settingsPromises)

    // Check if any user has spoiler protection enabled
    const enabledSettings = allSettings.filter(s => s.spoilerBlockEnabled)

    if (enabledSettings.length === 0) {
        return { enabled: false, cutoffDate: null }
    }

    // Find the earliest (most restrictive) cutoff date
    let earliestDate: Date | null = null

    for (const settings of enabledSettings) {
        // If enabled but no date, treat as start of today
        const effectiveDate = settings.spoilerBlockDate ?? startOfDay(new Date())

        if (earliestDate === null || effectiveDate < earliestDate) {
            earliestDate = effectiveDate
        }
    }

    return {
        enabled: true,
        cutoffDate: earliestDate
    }
}

/**
 * Convert a SpoilerPolicy to the format stored in Game.config.
 */
export function toStoredPolicy(policy: SpoilerPolicy): StoredSpoilerPolicy {
    return {
        enabled: policy.enabled,
        cutoffDate: policy.cutoffDate?.toISOString() ?? null
    }
}

/**
 * Convert a stored policy back to a SpoilerPolicy.
 */
export function fromStoredPolicy(stored: StoredSpoilerPolicy | undefined | null): SpoilerPolicy {
    if (!stored) {
        return { enabled: false, cutoffDate: null }
    }

    return {
        enabled: stored.enabled,
        cutoffDate: stored.cutoffDate ? new Date(stored.cutoffDate) : null
    }
}

/**
 * Build a Prisma-compatible filter condition for the airDate field.
 * 
 * When spoiler protection is enabled, this returns a condition that:
 * - Allows questions with null airDate (unknown date)
 * - Allows questions with airDate strictly before the cutoff
 * 
 * When spoiler protection is disabled, returns undefined (no filter).
 * 
 * @param policy The spoiler policy to apply
 * @returns A Prisma where condition for airDate, or undefined if no filtering needed
 */
export function buildAirDateFilter(policy: SpoilerPolicy): Prisma.QuestionWhereInput | undefined {
    if (!policy.enabled || !policy.cutoffDate) {
        return undefined
    }

    return {
        OR: [
            { airDate: null },
            { airDate: { lt: policy.cutoffDate } }
        ]
    }
}

/**
 * Build a simple airDate condition (not wrapped in OR) for use in nested queries.
 * Returns just the `{ lt: cutoffDate }` part when enabled, or undefined otherwise.
 * 
 * Useful when you need to apply the filter in a context that already handles null dates
 * or when combining with other conditions.
 */
export function buildSimpleAirDateCondition(policy: SpoilerPolicy): { lt: Date } | undefined {
    if (!policy.enabled || !policy.cutoffDate) {
        return undefined
    }

    return { lt: policy.cutoffDate }
}

/**
 * Load the effective spoiler policy for a game.
 * 
 * Priority:
 * 1. If the game has a stored spoilerProtection in config, use that
 * 2. Otherwise, compute from the game's participants (userId + opponentUserId)
 * 
 * This ensures consistent behavior: once a game is created with a specific
 * spoiler policy, that policy governs the entire game, even if participants
 * later change their profile settings.
 */
export async function getGameSpoilerPolicy(gameId: string): Promise<SpoilerPolicy> {
    const game = await prisma.game.findUnique({
        where: { id: gameId },
        select: {
            userId: true,
            opponentUserId: true,
            config: true
        }
    })

    if (!game) {
        // Game not found - return no protection (caller should handle 404)
        return { enabled: false, cutoffDate: null }
    }

    // Check if config has stored spoiler protection
    const config = game.config as Record<string, unknown> | null
    const storedPolicy = config?.spoilerProtection as StoredSpoilerPolicy | undefined

    if (storedPolicy) {
        return fromStoredPolicy(storedPolicy)
    }

    // Fall back to computing from participants
    const participantIds = [game.userId]
    if (game.opponentUserId) {
        participantIds.push(game.opponentUserId)
    }

    return computeCombinedSpoilerPolicy(participantIds)
}

/**
 * Check if a specific date would violate a spoiler policy.
 * Returns true if the date is on or after the cutoff (would be blocked).
 */
export function wouldViolateSpoilerPolicy(
    date: Date | string | null,
    policy: SpoilerPolicy
): boolean {
    if (!policy.enabled || !policy.cutoffDate) {
        return false
    }

    if (!date) {
        // Null dates are allowed (unknown air date)
        return false
    }

    const checkDate = typeof date === 'string' ? new Date(date) : date
    return checkDate >= policy.cutoffDate
}

/**
 * Format a spoiler policy cutoff date for display.
 */
export function formatCutoffDate(policy: SpoilerPolicy): string | null {
    if (!policy.enabled || !policy.cutoffDate) {
        return null
    }

    return policy.cutoffDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
}


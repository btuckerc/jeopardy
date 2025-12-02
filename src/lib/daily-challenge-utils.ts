/**
 * Utility functions for daily challenge timing
 */

/**
 * Get the timestamp for the next daily challenge (midnight UTC)
 * The daily challenge refreshes at midnight UTC each day
 */
export function getNextChallengeTime(): Date {
    const now = new Date()
    
    // Get tomorrow at midnight UTC
    const tomorrow = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0, 0, 0, 0
    ))
    
    return tomorrow
}

/**
 * Get the ISO string for the next daily challenge time
 * Safe to use in both server and client components
 */
export function getNextChallengeTimeISO(): string {
    return getNextChallengeTime().toISOString()
}


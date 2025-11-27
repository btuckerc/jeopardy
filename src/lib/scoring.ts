/**
 * Scoring utilities for statistics and leaderboard calculations.
 * 
 * This module defines how points are calculated for display in stats and leaderboards,
 * which may differ from the actual points stored in GameHistory (e.g., wager-based points
 * in game mode). This separation allows us to normalize scoring for stats while preserving
 * the original wager-based values for potential future use.
 * 
 * To change how Final Jeopardy questions are scored in stats/leaderboard, modify
 * FINAL_STATS_CLUE_VALUE below. This is the single source of truth for Final Jeopardy
 * scoring in statistics.
 */

export const DEFAULT_STATS_CLUE_VALUE = 200
export const FINAL_STATS_CLUE_VALUE = 2000

export type JeopardyRound = 'SINGLE' | 'DOUBLE' | 'FINAL'

export interface StatsPointsParams {
    round: JeopardyRound | string
    faceValue: number | null
    correct: boolean
    storedPoints?: number
}

/**
 * Calculate the points value to use for statistics and leaderboard calculations.
 * 
 * For Final Jeopardy questions, this returns a fixed value (FINAL_STATS_CLUE_VALUE)
 * regardless of the stored points (which may reflect wagers in game mode).
 * 
 * For other rounds, returns the question's face value (or DEFAULT_STATS_CLUE_VALUE if null).
 * 
 * @param params - The scoring parameters
 * @returns The normalized points value for stats/leaderboard, or 0 if incorrect
 */
export function getStatsPoints({
    round,
    faceValue,
    correct,
    storedPoints
}: StatsPointsParams): number {
    // Only award points for correct answers
    if (!correct) {
        return 0
    }

    // Final Jeopardy questions always use the fixed stats value
    if (round === 'FINAL') {
        return FINAL_STATS_CLUE_VALUE
    }

    // For other rounds, use the question's face value (or default)
    return faceValue ?? DEFAULT_STATS_CLUE_VALUE
}


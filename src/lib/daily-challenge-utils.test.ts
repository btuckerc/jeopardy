import { describe, expect, it } from 'vitest'
import {
    formatDailyChallengeDate,
    getActiveChallengeDateString,
    getDailyChallengeDateFromKey,
    getDailyChallengeDateKey,
} from './daily-challenge-utils'

describe('daily challenge date helpers', () => {
    it('preserves the challenge date key from midnight UTC timestamps', () => {
        expect(getDailyChallengeDateKey('2026-03-16T00:00:00.000Z')).toBe('2026-03-16')
        expect(formatDailyChallengeDate('2026-03-16T00:00:00.000Z')).toBe('Mar 16, 2026')
    })

    it('builds stable display dates from date keys', () => {
        const displayDate = getDailyChallengeDateFromKey('2026-03-16')
        expect(displayDate.toISOString()).toBe('2026-03-16T12:00:00.000Z')
    })

    it('switches the active day at 9 AM eastern', () => {
        expect(getActiveChallengeDateString(new Date('2026-03-16T12:59:00.000Z'))).toBe('2026-03-15')
        expect(getActiveChallengeDateString(new Date('2026-03-16T13:00:00.000Z'))).toBe('2026-03-16')
    })
})

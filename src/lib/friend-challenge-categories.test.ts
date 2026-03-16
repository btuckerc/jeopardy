import { describe, expect, it } from 'vitest'
import {
    clampFriendChallengeCategoryCount,
    getFriendChallengeSelectionProgress,
    normalizeFriendChallengeCategorySelection,
} from './friend-challenge-categories'

describe('friend challenge category helpers', () => {
    it('normalizes legacy chosen selections to custom', () => {
        expect(normalizeFriendChallengeCategorySelection('CHOSEN')).toBe('CUSTOM')
        expect(normalizeFriendChallengeCategorySelection('custom')).toBe('CUSTOM')
        expect(normalizeFriendChallengeCategorySelection('RANDOM')).toBe('RANDOM')
        expect(normalizeFriendChallengeCategorySelection(undefined)).toBe('RANDOM')
    })

    it('clamps category counts to the supported board range', () => {
        expect(clampFriendChallengeCategoryCount(undefined)).toBe(1)
        expect(clampFriendChallengeCategoryCount(0)).toBe(1)
        expect(clampFriendChallengeCategoryCount(4)).toBe(4)
        expect(clampFriendChallengeCategoryCount(99)).toBe(6)
    })

    it('tracks remaining custom slots and auto-fill state', () => {
        expect(getFriendChallengeSelectionProgress(0, 4)).toEqual({
            selectedCount: 0,
            categoryCount: 4,
            remainingCount: 4,
            isComplete: false,
            willAutoFill: false,
        })

        expect(getFriendChallengeSelectionProgress(2, 4)).toEqual({
            selectedCount: 2,
            categoryCount: 4,
            remainingCount: 2,
            isComplete: false,
            willAutoFill: true,
        })

        expect(getFriendChallengeSelectionProgress(6, 4)).toEqual({
            selectedCount: 4,
            categoryCount: 4,
            remainingCount: 0,
            isComplete: true,
            willAutoFill: false,
        })
    })
})

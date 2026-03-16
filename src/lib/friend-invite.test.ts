import { describe, expect, it } from 'vitest'
import {
    extractInviteTokenFromInput,
    formatFriendCode,
    FRIEND_CODE_LENGTH,
    isFriendCodeCandidate,
    normalizeFriendCode,
} from './friend-invite'

describe('friend invite helpers', () => {
    it('normalizes friend codes for matching', () => {
        expect(normalizeFriendCode('ab cd-2345jk')).toBe('ABCD2345JK')
    })

    it('formats friend codes in readable groups', () => {
        expect(formatFriendCode('abcd2345jk')).toBe('ABCD2-345JK')
    })

    it('recognizes only codes that match the allowed alphabet and length', () => {
        expect(isFriendCodeCandidate('ABCD2-345JK')).toBe(true)
        expect(isFriendCodeCandidate('ABCD2-345J0')).toBe(false)
        expect(isFriendCodeCandidate('SHORT')).toBe(false)
        expect(isFriendCodeCandidate('A'.repeat(FRIEND_CODE_LENGTH + 1))).toBe(false)
    })

    it('extracts invite tokens from pasted invite links', () => {
        expect(extractInviteTokenFromInput('https://example.com/friends?invite=abc123')).toBe('abc123')
        expect(extractInviteTokenFromInput('not-a-link')).toBeNull()
    })
})

import { describe, expect, it } from 'vitest'
import { FriendChallengeStatus } from '@prisma/client'
import {
    finalizeReconciledGameChallengeState,
    getChallengeGameScore,
    reconcileGameChallengeState,
    type ChallengeGameState,
} from './friend-challenge-state'

function makeGameState(overrides: Partial<ChallengeGameState> = {}): ChallengeGameState {
    return {
        id: 'game_123',
        status: 'IN_PROGRESS',
        currentScore: 0,
        answeredCount: 0,
        ...overrides,
    }
}

describe('friend challenge state', () => {
    it('ignores placeholder zero scores from untouched challenge games', () => {
        expect(getChallengeGameScore(makeGameState(), 0)).toBeNull()
        expect(getChallengeGameScore(makeGameState(), null)).toBeNull()
    })

    it('self-heals prematurely completed challenges back to accepted when the other player has not finished', () => {
        const reconciled = reconcileGameChallengeState(
            {
                status: FriendChallengeStatus.COMPLETED,
                challengerUserId: 'user_challenger',
                opponentUserId: 'user_opponent',
                challengerScore: 0,
                opponentScore: 4200,
                winnerUserId: 'user_opponent',
                completedAt: new Date('2026-03-16T14:00:00.000Z'),
            },
            makeGameState(),
            makeGameState({ status: 'COMPLETED', currentScore: 4200, answeredCount: 30 }),
        )

        expect(reconciled.status).toBe(FriendChallengeStatus.ACCEPTED)
        expect(reconciled.challengerScore).toBeNull()
        expect(reconciled.opponentScore).toBe(4200)
        expect(reconciled.winnerUserId).toBeNull()
        expect(reconciled.completedAt).toBeNull()
    })

    it('marks a challenge completed only when both players have actually finished', () => {
        const reconciled = reconcileGameChallengeState(
            {
                status: FriendChallengeStatus.ACCEPTED,
                challengerUserId: 'user_challenger',
                opponentUserId: 'user_opponent',
                challengerScore: null,
                opponentScore: null,
                winnerUserId: null,
                completedAt: null,
            },
            makeGameState({ status: 'COMPLETED', currentScore: 5600, answeredCount: 30 }),
            makeGameState({ status: 'COMPLETED', currentScore: 4800, answeredCount: 30 }),
        )

        expect(reconciled.status).toBe(FriendChallengeStatus.COMPLETED)
        expect(reconciled.challengerScore).toBe(5600)
        expect(reconciled.opponentScore).toBe(4800)
        expect(reconciled.winnerUserId).toBe('user_challenger')
    })

    it('cancels stale completed challenges that cannot return to accepted because a newer active challenge exists', () => {
        const challenge = {
            status: FriendChallengeStatus.COMPLETED,
            challengerUserId: 'user_challenger',
            opponentUserId: 'user_opponent',
            challengerScore: 0,
            opponentScore: 4200,
            winnerUserId: 'user_opponent',
            completedAt: new Date('2026-03-16T14:00:00.000Z'),
        }

        const finalized = finalizeReconciledGameChallengeState({
            challenge,
            reconciled: reconcileGameChallengeState(
                challenge,
                makeGameState(),
                makeGameState({ status: 'COMPLETED', currentScore: 4200, answeredCount: 30 }),
            ),
            hasConflictingActiveChallenge: true,
        })

        expect(finalized.status).toBe(FriendChallengeStatus.CANCELLED)
        expect(finalized.challengerScore).toBeNull()
        expect(finalized.opponentScore).toBeNull()
        expect(finalized.winnerUserId).toBeNull()
        expect(finalized.completedAt).toBeNull()
    })
})

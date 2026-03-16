import { FriendChallengeStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface ChallengeGameState {
    id: string
    status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'
    currentScore: number
    answeredCount: number
}

export interface GameChallengeState {
    status: FriendChallengeStatus
    challengerUserId: string
    opponentUserId: string
    challengerScore: number | null
    opponentScore: number | null
    winnerUserId: string | null
    completedAt: Date | null
}

type ChallengeGameQueryClient = {
    $queryRaw: typeof prisma.$queryRaw
}

type ChallengeConflictQueryClient = {
    friendChallenge: {
        findFirst: typeof prisma.friendChallenge.findFirst
    }
}

export async function findChallengeGameStateForUser(
    db: ChallengeGameQueryClient,
    params: {
        userId: string
        challengeId: string
    },
): Promise<ChallengeGameState | null> {
    const rows = await db.$queryRaw<Array<ChallengeGameState>>`
        SELECT
            g."id",
            g."status",
            g."currentScore",
            COALESCE((
                SELECT COUNT(*)::int
                FROM "GameQuestion" gq
                WHERE gq."gameId" = g."id"
                  AND gq."answered" = true
            ), 0) AS "answeredCount"
        FROM "Game" g
        WHERE g."userId" = ${params.userId}
          AND g."config"->>'friendChallengeId' = ${params.challengeId}
          AND g."status" IN ('IN_PROGRESS', 'COMPLETED')
        ORDER BY
            CASE
                WHEN g."status" = 'COMPLETED' THEN 2
                WHEN EXISTS (
                    SELECT 1
                    FROM "GameQuestion" gq
                    WHERE gq."gameId" = g."id"
                      AND gq."answered" = true
                ) THEN 1
                ELSE 0
            END DESC,
            g."createdAt" DESC
        LIMIT 1
    `

    return rows[0] ?? null
}

export function hasChallengeGameProgress(game: ChallengeGameState | null | undefined): boolean {
    if (!game) {
        return false
    }

    return game.status === 'COMPLETED' || game.answeredCount > 0
}

export function getChallengeGameScore(
    game: ChallengeGameState | null | undefined,
    persistedScore: number | null,
): number | null {
    if (!game) {
        return persistedScore
    }

    if (hasChallengeGameProgress(game)) {
        return game.currentScore
    }

    return null
}

export function reconcileGameChallengeState(
    challenge: GameChallengeState,
    challengerGame: ChallengeGameState | null,
    opponentGame: ChallengeGameState | null,
): {
    challengerScore: number | null
    opponentScore: number | null
    winnerUserId: string | null
    status: FriendChallengeStatus
    completedAt: Date | null
    bothPlayersFinished: boolean
} {
    const challengerScore = getChallengeGameScore(challengerGame, challenge.challengerScore)
    const opponentScore = getChallengeGameScore(opponentGame, challenge.opponentScore)
    const bothPlayersFinished = challengerGame?.status === 'COMPLETED' && opponentGame?.status === 'COMPLETED'

    if (!bothPlayersFinished) {
        const nextStatus = challenge.status === FriendChallengeStatus.COMPLETED
            ? FriendChallengeStatus.ACCEPTED
            : challenge.status

        return {
            challengerScore,
            opponentScore,
            winnerUserId: null,
            status: nextStatus,
            completedAt: null,
            bothPlayersFinished: false,
        }
    }

    const winnerUserId =
        challengerScore! > opponentScore!
            ? challenge.challengerUserId
            : opponentScore! > challengerScore!
                ? challenge.opponentUserId
                : null

    return {
        challengerScore,
        opponentScore,
        winnerUserId,
        status: FriendChallengeStatus.COMPLETED,
        completedAt: challenge.completedAt,
        bothPlayersFinished: true,
    }
}

export function finalizeReconciledGameChallengeState(params: {
    challenge: GameChallengeState
    reconciled: ReturnType<typeof reconcileGameChallengeState>
    hasConflictingActiveChallenge: boolean
}): ReturnType<typeof reconcileGameChallengeState> {
    if (
        params.challenge.status !== FriendChallengeStatus.COMPLETED
        || params.reconciled.status !== FriendChallengeStatus.ACCEPTED
        || !params.hasConflictingActiveChallenge
    ) {
        return params.reconciled
    }

    return {
        ...params.reconciled,
        challengerScore: null,
        opponentScore: null,
        winnerUserId: null,
        status: FriendChallengeStatus.CANCELLED,
        completedAt: null,
        bothPlayersFinished: false,
    }
}

export async function hasConflictingActiveChallengeForPair(
    db: ChallengeConflictQueryClient,
    params: {
        challengeId: string
        challengerUserId: string
        opponentUserId: string
    },
): Promise<boolean> {
    const conflictingChallenge = await db.friendChallenge.findFirst({
        where: {
            id: { not: params.challengeId },
            OR: [
                {
                    challengerUserId: params.challengerUserId,
                    opponentUserId: params.opponentUserId,
                },
                {
                    challengerUserId: params.opponentUserId,
                    opponentUserId: params.challengerUserId,
                },
            ],
            status: {
                in: [
                    FriendChallengeStatus.PENDING,
                    FriendChallengeStatus.ACCEPTED,
                ],
            },
        },
        select: { id: true },
    })

    return Boolean(conflictingChallenge)
}

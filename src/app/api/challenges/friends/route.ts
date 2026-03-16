import { z } from 'zod'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { FriendActivityType, FriendChallengeMode, FriendChallengeStatus, Prisma } from '@prisma/client'
import { nanoid } from 'nanoid'
import {
    badRequestResponse,
    errorResponse,
    jsonResponse,
    parseBody,
    parseSearchParams,
    requireAuth,
    serverErrorResponse
} from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import {
    clampFriendChallengeCategoryCount,
    FRIEND_CHALLENGE_MAX_CATEGORY_COUNT,
    FRIEND_CHALLENGE_MIN_SELECTED_QUESTION_COUNT,
    normalizeFriendChallengeCategorySelection,
} from '@/lib/friend-challenge-categories'
import {
    getCustomCategorySelectionKey,
    type CustomCategorySelection,
} from '@/lib/custom-category-selections'
import { hasBlockedRelationship, isFriend } from '@/lib/friends'

const customCategorySelectionSchema = z.object({
    categoryId: z.string(),
    airDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    round: z.enum(['SINGLE', 'DOUBLE']),
})

const challengeSchema = z.object({
    action: z.enum(['create', 'accept', 'decline', 'complete', 'cancel', 'launch', 'end']).default('create'),
    opponentId: z.string().optional(),
    challengeId: z.string().optional(),
    mode: z.nativeEnum(FriendChallengeMode).default(FriendChallengeMode.PRACTICE),
    categorySelection: z.enum(['RANDOM', 'CHOSEN', 'CUSTOM']).default('RANDOM'),
    categoryCount: z.number().int().min(1).max(FRIEND_CHALLENGE_MAX_CATEGORY_COUNT).optional(),
    categoryIds: z.array(z.string()).max(FRIEND_CHALLENGE_MAX_CATEGORY_COUNT).optional(),
    categorySelections: z.array(customCategorySelectionSchema).max(FRIEND_CHALLENGE_MAX_CATEGORY_COUNT).optional(),
    message: z.string().trim().max(500, 'Message is too long').optional().nullable(),
    targetValue: z.number().int().positive().max(100000).optional(),
    expiresAt: z.string().datetime().optional(),
    challengerScore: z.number().int().min(0).max(100000).optional(),
    opponentScore: z.number().int().min(0).max(100000).optional(),
})

const challengeListSchema = z.object({
    status: z
        .enum([
            FriendChallengeStatus.PENDING,
            FriendChallengeStatus.ACCEPTED,
            FriendChallengeStatus.DECLINED,
            FriendChallengeStatus.COMPLETED,
            FriendChallengeStatus.CANCELLED,
            FriendChallengeStatus.EXPIRED,
            'all',
        ] as const)
        .default('all'),
    includeExpired: z.coerce.boolean().default(false),
    limit: z.coerce.number().int().min(1).max(100).default(100),
})

function challengeParticipantMetadata(challenge: { challengerUserId: string, opponentUserId: string }) {
    return {
        challengeChallengerUserId: challenge.challengerUserId,
        challengeOpponentUserId: challenge.opponentUserId,
    }
}

function normalizeDate(value?: string): Date | undefined {
    if (!value) return undefined
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        throw new Error('Invalid date format for expiresAt')
    }
    return date
}

function buildChallengeInclude() {
    return {
        challenger: {
            select: {
                id: true,
                displayName: true,
                selectedIcon: true,
                avatarBackground: true,
            },
        },
        opponent: {
            select: {
                id: true,
                displayName: true,
                selectedIcon: true,
                avatarBackground: true,
            },
        },
        winner: {
            select: {
                id: true,
                displayName: true,
                selectedIcon: true,
                avatarBackground: true,
            },
        },
    } as const
}

type ChallengeRole = 'CHALLENGER' | 'OPPONENT'

type ChallengeGameConfig = {
    friendChallengeId?: string
    friendChallengeRole?: ChallengeRole
    friendChallengeBoardCategoryId?: string
    friendChallengeBoardCategoryIds?: string[]
    friendChallengeBoardCategorySelections?: CustomCategorySelection[]
    categorySelections?: CustomCategorySelection[]
}

function parseChallengeGameConfig(config: unknown): ChallengeGameConfig {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return {}
    }

    const typed = config as Record<string, unknown>
    return {
        friendChallengeId: typeof typed.friendChallengeId === 'string' ? typed.friendChallengeId : undefined,
        friendChallengeRole: typed.friendChallengeRole === 'CHALLENGER' || typed.friendChallengeRole === 'OPPONENT'
            ? typed.friendChallengeRole
            : undefined,
        friendChallengeBoardCategoryId: typeof typed.friendChallengeBoardCategoryId === 'string'
            ? typed.friendChallengeBoardCategoryId
            : undefined,
        friendChallengeBoardCategoryIds: Array.isArray(typed.friendChallengeBoardCategoryIds)
            ? typed.friendChallengeBoardCategoryIds.filter((value): value is string => typeof value === 'string')
            : undefined,
        friendChallengeBoardCategorySelections: Array.isArray(typed.friendChallengeBoardCategorySelections)
            ? typed.friendChallengeBoardCategorySelections.filter((value): value is CustomCategorySelection => (
                !!value
                && typeof value === 'object'
                && !Array.isArray(value)
                && typeof (value as CustomCategorySelection).categoryId === 'string'
                && typeof (value as CustomCategorySelection).airDate === 'string'
                && ((value as CustomCategorySelection).round === 'SINGLE' || (value as CustomCategorySelection).round === 'DOUBLE')
            ))
            : undefined,
        categorySelections: Array.isArray(typed.categorySelections)
            ? typed.categorySelections.filter((value): value is CustomCategorySelection => (
                !!value
                && typeof value === 'object'
                && !Array.isArray(value)
                && typeof (value as CustomCategorySelection).categoryId === 'string'
                && typeof (value as CustomCategorySelection).airDate === 'string'
                && ((value as CustomCategorySelection).round === 'SINGLE' || (value as CustomCategorySelection).round === 'DOUBLE')
            ))
            : undefined,
    }
}

async function findChallengeGameIdForUser(params: {
    userId: string
    challengeId: string
}) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Game"
        WHERE "userId" = ${params.userId}
          AND "config"->>'friendChallengeId' = ${params.challengeId}
          AND "status" IN ('IN_PROGRESS', 'COMPLETED')
        ORDER BY "createdAt" DESC
        LIMIT 1
    `

    return rows[0]?.id ?? null
}

async function findPreviousBoardCategoryIdsForMatchup(params: {
    challengerUserId: string
    opponentUserId: string
}) {
    const previousGameChallenge = await prisma.friendChallenge.findFirst({
        where: {
            mode: FriendChallengeMode.GAME,
            OR: [
                { challengerUserId: params.challengerUserId, opponentUserId: params.opponentUserId },
                { challengerUserId: params.opponentUserId, opponentUserId: params.challengerUserId },
            ],
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
    })

    if (!previousGameChallenge) {
        return []
    }

    return (await getChallengeBoardMetadata(previousGameChallenge.id)).boardCategoryIds
}

async function selectBoardCategoryIds(
    count: number,
    options: { excludeCategoryIds?: string[]; minQuestionCount?: number } = {},
): Promise<string[]> {
    const excluded = Array.from(new Set((options.excludeCategoryIds || []).filter(Boolean)))
    const minQuestionCount = Math.max(
        options.minQuestionCount ?? FRIEND_CHALLENGE_MIN_SELECTED_QUESTION_COUNT,
        FRIEND_CHALLENGE_MIN_SELECTED_QUESTION_COUNT,
    )
    const exclusionClause = excluded.length > 0
        ? Prisma.sql`WHERE e."categoryId" NOT IN (${Prisma.join(excluded)})`
        : Prisma.empty

    const rows = await prisma.$queryRaw<Array<{ categoryId: string }>>`
        WITH eligible AS (
            SELECT q."categoryId"
            FROM "Question" q
            WHERE q."round" = 'SINGLE'::"JeopardyRound"
            GROUP BY q."categoryId"
            HAVING COUNT(*) >= ${minQuestionCount}
        )
        SELECT e."categoryId"
        FROM eligible e
        ${exclusionClause}
        ORDER BY RANDOM()
        LIMIT ${count}
    `

    if (rows.length >= count || excluded.length === 0) {
        return rows.map((row) => row.categoryId)
    }

    const fallbackRows = await prisma.$queryRaw<Array<{ categoryId: string }>>`
        WITH eligible AS (
            SELECT q."categoryId"
            FROM "Question" q
            WHERE q."round" = 'SINGLE'::"JeopardyRound"
            GROUP BY q."categoryId"
            HAVING COUNT(*) >= ${minQuestionCount}
        )
        SELECT e."categoryId"
        FROM eligible e
        ORDER BY RANDOM()
        LIMIT ${count}
    `

    return fallbackRows.map((row) => row.categoryId)
}

function normalizeBoardCategorySelections(selections: CustomCategorySelection[]): CustomCategorySelection[] {
    const seen = new Set<string>()

    return selections.filter((selection) => {
        const key = getCustomCategorySelectionKey(selection)
        if (seen.has(key)) {
            return false
        }

        seen.add(key)
        return true
    })
}

async function selectBoardCategorySelections(
    count: number,
    options: { excludeCategoryIds?: string[] } = {},
): Promise<CustomCategorySelection[]> {
    const excludedCategoryIds = Array.from(new Set((options.excludeCategoryIds || []).filter(Boolean)))
    const exclusionClause = excludedCategoryIds.length > 0
        ? Prisma.sql`AND q."categoryId" NOT IN (${Prisma.join(excludedCategoryIds)})`
        : Prisma.empty

    const rows = await prisma.$queryRaw<Array<{
        categoryId: string
        airDate: Date
        round: 'SINGLE' | 'DOUBLE'
    }>>`
        SELECT q."categoryId", q."airDate", q."round"
        FROM "Question" q
        WHERE q."round" = 'SINGLE'::"JeopardyRound"
          AND q."airDate" IS NOT NULL
          ${exclusionClause}
        GROUP BY q."categoryId", q."airDate", q."round"
        HAVING COUNT(*) >= ${FRIEND_CHALLENGE_MIN_SELECTED_QUESTION_COUNT}
        ORDER BY RANDOM()
        LIMIT ${count}
    `

    return rows.map((row) => ({
        categoryId: row.categoryId,
        airDate: row.airDate.toISOString().slice(0, 10),
        round: row.round,
    }))
}

async function filterPlayableCategoryIds(
    categoryIds: string[],
    minQuestionCount: number = FRIEND_CHALLENGE_MIN_SELECTED_QUESTION_COUNT,
): Promise<string[]> {
    if (categoryIds.length === 0) {
        return []
    }

    const grouped = await prisma.question.groupBy({
        by: ['categoryId'],
        where: {
            round: 'SINGLE',
            categoryId: { in: categoryIds },
        },
        _count: { id: true },
    })

    return grouped
        .filter((row) => row._count.id >= Math.max(minQuestionCount, FRIEND_CHALLENGE_MIN_SELECTED_QUESTION_COUNT))
        .map((row) => row.categoryId)
}

async function filterPlayableCategorySelections(
    selections: CustomCategorySelection[],
): Promise<CustomCategorySelection[]> {
    if (selections.length === 0) {
        return []
    }

    const pairs = Prisma.join(selections.map((selection) => Prisma.sql`(${selection.categoryId}, ${new Date(selection.airDate)}, ${selection.round}::"JeopardyRound")`))

    const rows = await prisma.$queryRaw<Array<{
        categoryId: string
        airDate: Date
        round: 'SINGLE' | 'DOUBLE'
    }>>`
        WITH requested("categoryId", "airDate", "round") AS (
            VALUES ${pairs}
        )
        SELECT q."categoryId", q."airDate", q."round"
        FROM "Question" q
        INNER JOIN requested r
            ON q."categoryId" = r."categoryId"
           AND q."airDate" = r."airDate"
           AND q."round" = r."round"
        GROUP BY q."categoryId", q."airDate", q."round"
        HAVING COUNT(*) >= ${FRIEND_CHALLENGE_MIN_SELECTED_QUESTION_COUNT}
    `

    const playableKeys = new Set(
        rows.map((row) => getCustomCategorySelectionKey({
            categoryId: row.categoryId,
            airDate: row.airDate.toISOString().slice(0, 10),
            round: row.round,
        })),
    )

    return selections.filter((selection) => playableKeys.has(getCustomCategorySelectionKey(selection)))
}

async function createChallengeGame(params: {
    userId: string
    challengeId: string
    role: ChallengeRole
    boardCategoryIds: string[]
    boardCategorySelections?: CustomCategorySelection[]
}) {
    const gameSeed = nanoid(10)

    const config = {
        mode: 'custom',
        categoryIds: params.boardCategoryIds,
        categorySelections: params.boardCategorySelections,
        rounds: { single: true, double: false, final: false },
        preset: 'challenge',
        friendChallengeId: params.challengeId,
        friendChallengeRole: params.role,
        friendChallengeBoardCategoryIds: params.boardCategoryIds,
        friendChallengeBoardCategoryId: params.boardCategoryIds[0],
        friendChallengeBoardCategorySelections: params.boardCategorySelections,
        spoilerProtection: {
            enabled: false,
            cutoffDate: null,
        },
    } as unknown as Prisma.InputJsonValue

    return prisma.game.create({
        data: {
            userId: params.userId,
            seed: gameSeed,
            config,
            status: 'IN_PROGRESS',
            currentRound: 'SINGLE',
            currentScore: 0,
            visibility: 'PRIVATE',
            useKnowledgeCategories: false,
        },
    })
}

async function ensureChallengeGameForUser(params: {
    challengeId: string
    userId: string
    role: ChallengeRole
}) {
    const existingGameId = await findChallengeGameIdForUser({
        userId: params.userId,
        challengeId: params.challengeId,
    })
    if (existingGameId) {
        return existingGameId
    }

    const templateRows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Game"
        WHERE "config"->>'friendChallengeId' = ${params.challengeId}
        ORDER BY "createdAt" ASC
        LIMIT 1
    `

    const templateId = templateRows[0]?.id
    const templateGame = templateId
        ? await prisma.game.findUnique({
            where: { id: templateId },
            select: { config: true },
        })
        : null

    const templateConfig = parseChallengeGameConfig(templateGame?.config)
    const boardCategoryIds = templateConfig.friendChallengeBoardCategoryIds && templateConfig.friendChallengeBoardCategoryIds.length > 0
        ? templateConfig.friendChallengeBoardCategoryIds
        : templateConfig.friendChallengeBoardCategoryId
            ? [templateConfig.friendChallengeBoardCategoryId]
            : await selectBoardCategoryIds(1)
    const boardCategorySelections = templateConfig.friendChallengeBoardCategorySelections
        || templateConfig.categorySelections
        || []

    if (!boardCategoryIds || boardCategoryIds.length === 0) {
        throw new Error('No eligible challenge category found for game mode')
    }

    const createdGame = await createChallengeGame({
        userId: params.userId,
        challengeId: params.challengeId,
        role: params.role,
        boardCategoryIds,
        boardCategorySelections,
    })
    return createdGame.id
}

async function findChallengeGameStateForUser(params: {
    userId: string
    challengeId: string
}) {
    const rows = await prisma.$queryRaw<Array<{ id: string, status: string, currentScore: number }>>`
        SELECT "id", "status", "currentScore"
        FROM "Game"
        WHERE "userId" = ${params.userId}
          AND "config"->>'friendChallengeId' = ${params.challengeId}
        ORDER BY "createdAt" DESC
        LIMIT 1
    `

    return rows[0] ?? null
}

async function getChallengeBoardMetadata(challengeId: string): Promise<{
    boardCategoryId: string | null
    boardCategoryIds: string[]
    boardCategories: Array<{ id: string; name: string }>
}> {
    const rows = await prisma.$queryRaw<Array<{ config: unknown }>>`
        SELECT "config"
        FROM "Game"
        WHERE "config"->>'friendChallengeId' = ${challengeId}
        ORDER BY "createdAt" ASC
        LIMIT 1
    `

    const parsed = parseChallengeGameConfig(rows[0]?.config)
    const boardCategoryIds = parsed.friendChallengeBoardCategoryIds && parsed.friendChallengeBoardCategoryIds.length > 0
        ? parsed.friendChallengeBoardCategoryIds
        : parsed.friendChallengeBoardCategoryId
            ? [parsed.friendChallengeBoardCategoryId]
            : []

    if (boardCategoryIds.length === 0) {
        return {
            boardCategoryId: null,
            boardCategoryIds: [],
            boardCategories: [],
        }
    }

    const categories = await prisma.category.findMany({
        where: {
            id: { in: boardCategoryIds },
        },
        select: {
            id: true,
            name: true,
        },
    })

    const categoriesById = new Map(categories.map((category) => [category.id, category]))
    const orderedCategories = boardCategoryIds
        .map((id) => categoriesById.get(id))
        .filter((category): category is { id: string; name: string } => Boolean(category))

    return {
        boardCategoryId: boardCategoryIds[0] ?? null,
        boardCategoryIds,
        boardCategories: orderedCategories,
    }
}

export const GET = withInstrumentation(async (request: NextRequest) => {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const parsed = parseSearchParams(searchParams, challengeListSchema)
    if (parsed.error) return parsed.error

    const now = new Date()
    const { status, includeExpired, limit } = parsed.data

    try {
        await prisma.friendChallenge.updateMany({
            where: {
                OR: [
                    { challengerUserId: user.id },
                    { opponentUserId: user.id },
                ],
                status: FriendChallengeStatus.PENDING,
                expiresAt: { lte: now },
            },
            data: { status: FriendChallengeStatus.EXPIRED },
        })

        const where: Prisma.FriendChallengeWhereInput = {
            OR: [
                { challengerUserId: user.id },
                { opponentUserId: user.id },
            ],
        }

        if (status !== 'all') {
            where.status = status as FriendChallengeStatus
        }

        if (!includeExpired && status !== FriendChallengeStatus.EXPIRED) {
            where.AND = [
                {
                    ...(status === FriendChallengeStatus.PENDING
                        ? { status: FriendChallengeStatus.PENDING, expiresAt: { gt: now } }
                        : { OR: [
                            { status: { not: FriendChallengeStatus.PENDING } },
                            { status: FriendChallengeStatus.PENDING, expiresAt: { gt: now } },
                        ] }),
                },
            ]
        }

        const challenges = await prisma.friendChallenge.findMany({
            where,
            include: buildChallengeInclude(),
            orderBy: { updatedAt: 'desc' },
            take: limit,
        })

        const normalizedChallenges = challenges.map((challenge) => {
            if (
                challenge.status === FriendChallengeStatus.PENDING &&
                challenge.expiresAt <= now
            ) {
                return {
                    ...challenge,
                    status: FriendChallengeStatus.EXPIRED,
                }
            }
            return challenge
        })

        const reconciledChallenges = await Promise.all(
            normalizedChallenges.map(async (challenge) => {
                if (challenge.mode !== FriendChallengeMode.GAME) {
                    return {
                        ...challenge,
                        challengerGameId: null,
                        opponentGameId: null,
                        boardCategoryId: null,
                        boardCategoryIds: [],
                        boardCategories: [],
                    }
                }

                const [challengerGame, opponentGame, boardMetadata] = await Promise.all([
                    findChallengeGameStateForUser({
                        userId: challenge.challengerUserId,
                        challengeId: challenge.id,
                    }),
                    findChallengeGameStateForUser({
                        userId: challenge.opponentUserId,
                        challengeId: challenge.id,
                    }),
                    getChallengeBoardMetadata(challenge.id),
                ])

                const nextChallengerScore = challengerGame?.currentScore ?? challenge.challengerScore
                const nextOpponentScore = opponentGame?.currentScore ?? challenge.opponentScore
                const shouldComplete =
                    challenge.status === FriendChallengeStatus.ACCEPTED
                    && challengerGame?.status === 'COMPLETED'
                    && opponentGame?.status === 'COMPLETED'

                const scoreChanged = nextChallengerScore !== challenge.challengerScore
                    || nextOpponentScore !== challenge.opponentScore

                if (!scoreChanged && !shouldComplete) {
                    return {
                        ...challenge,
                        challengerGameId: challengerGame?.id ?? null,
                        opponentGameId: opponentGame?.id ?? null,
                        boardCategoryId: boardMetadata.boardCategoryId,
                        boardCategoryIds: boardMetadata.boardCategoryIds,
                        boardCategories: boardMetadata.boardCategories,
                    }
                }

                const nextWinnerUserId = shouldComplete
                    ? nextChallengerScore! > nextOpponentScore!
                        ? challenge.challengerUserId
                        : nextOpponentScore! > nextChallengerScore!
                            ? challenge.opponentUserId
                            : null
                    : challenge.winnerUserId

                const updatedChallenge = await prisma.$transaction(async (tx) => {
                    const updated = await tx.friendChallenge.update({
                        where: { id: challenge.id },
                        data: {
                            challengerScore: nextChallengerScore,
                            opponentScore: nextOpponentScore,
                            ...(shouldComplete
                                ? {
                                    status: FriendChallengeStatus.COMPLETED,
                                    completedAt: now,
                                    winnerUserId: nextWinnerUserId,
                                }
                                : {}),
                        },
                        include: buildChallengeInclude(),
                    })

                    if (shouldComplete) {
                        await tx.friendActivity.create({
                            data: {
                                actorUserId: challenge.challengerUserId,
                                relatedUserId: challenge.opponentUserId,
                                challengeId: challenge.id,
                                activityType: FriendActivityType.CHALLENGE_COMPLETED,
                                metadata: {
                                    challengeId: challenge.id,
                                    challengerScore: nextChallengerScore,
                                    opponentScore: nextOpponentScore,
                                    ...challengeParticipantMetadata(challenge),
                                },
                            },
                        })
                    }

                    return updated
                })

                return {
                    ...updatedChallenge,
                    challengerGameId: challengerGame?.id ?? null,
                    opponentGameId: opponentGame?.id ?? null,
                    boardCategoryId: boardMetadata.boardCategoryId,
                    boardCategoryIds: boardMetadata.boardCategoryIds,
                    boardCategories: boardMetadata.boardCategories,
                }
            }),
        )

        return jsonResponse({
            challenges: reconciledChallenges,
            now: now.toISOString(),
        })
    } catch (error) {
        return serverErrorResponse('Error loading friend challenges', error)
    }
})

export const POST = withInstrumentation(async (request: NextRequest) => {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const parsed = await parseBody(request, challengeSchema)
    if (parsed.error) return parsed.error

    const now = new Date()
    const {
        action,
        opponentId,
        challengeId,
        mode,
        categorySelection: rawCategorySelection,
        categoryCount,
        categoryIds,
        categorySelections,
        message,
        targetValue,
        expiresAt,
        challengerScore,
        opponentScore,
    } = parsed.data
    const categorySelection = normalizeFriendChallengeCategorySelection(rawCategorySelection)

    try {
        if (action === 'create') {
            if (!opponentId) {
                return badRequestResponse('opponentId is required')
            }

            if (opponentId === user.id) {
                return badRequestResponse('You cannot challenge yourself')
            }

            if (!(await isFriend(user.id, opponentId))) {
                return badRequestResponse('You can only challenge friends')
            }

            if (await hasBlockedRelationship(user.id, opponentId)) {
                return badRequestResponse('This user is blocked')
            }

            const parsedExpiresAt = normalizeDate(expiresAt)
            if (parsedExpiresAt && parsedExpiresAt <= now) {
                return badRequestResponse('Challenge expiration must be in the future')
            }

            // Self-heal stale pending rows so expired challenges never block new creates.
            await prisma.friendChallenge.updateMany({
                where: {
                    OR: [
                        { challengerUserId: user.id, opponentUserId: opponentId },
                        { challengerUserId: opponentId, opponentUserId: user.id },
                    ],
                    status: FriendChallengeStatus.PENDING,
                    expiresAt: { lte: now },
                },
                data: { status: FriendChallengeStatus.EXPIRED },
            })

            let boardCategoryIds: string[] = []
            let boardCategorySelections: CustomCategorySelection[] = []
            if (mode === FriendChallengeMode.GAME) {
                const desiredCount = clampFriendChallengeCategoryCount(categoryCount)
                const previousBoardCategoryIds = await findPreviousBoardCategoryIdsForMatchup({
                    challengerUserId: user.id,
                    opponentUserId: opponentId,
                })

                if (categorySelection === 'CUSTOM') {
                    const normalizedSelections = normalizeBoardCategorySelections(
                        (categorySelections || []).filter((selection) => selection.round === 'SINGLE'),
                    ).slice(0, FRIEND_CHALLENGE_MAX_CATEGORY_COUNT)

                    const legacySelected = normalizedSelections.length === 0
                        ? Array.from(new Set((categoryIds || []).filter(Boolean))).slice(
                            0,
                            FRIEND_CHALLENGE_MAX_CATEGORY_COUNT,
                        )
                        : []

                    if (normalizedSelections.length === 0 && legacySelected.length === 0) {
                        return badRequestResponse('Select at least one category for custom mode')
                    }

                    if (normalizedSelections.length > desiredCount || legacySelected.length > desiredCount) {
                        return badRequestResponse(`Select up to ${desiredCount} categories for custom mode`)
                    }

                    if (normalizedSelections.length > 0) {
                        const playableSelections = await filterPlayableCategorySelections(normalizedSelections)
                        if (playableSelections.length !== normalizedSelections.length) {
                            return badRequestResponse('One or more selected board variants no longer have a full playable set')
                        }

                        const excludedForAutoFill = [
                            ...normalizedSelections.map((selection) => selection.categoryId),
                            ...previousBoardCategoryIds.filter((categoryId) => (
                                !normalizedSelections.some((selection) => selection.categoryId === categoryId)
                            )),
                        ]

                        const autoFillSelections = await selectBoardCategorySelections(
                            Math.max(desiredCount - normalizedSelections.length, 0),
                            {
                                excludeCategoryIds: excludedForAutoFill,
                            },
                        )

                        boardCategorySelections = [...normalizedSelections, ...autoFillSelections]
                        boardCategoryIds = boardCategorySelections.map((selection) => selection.categoryId)
                    } else {
                        const playable = await filterPlayableCategoryIds(
                            legacySelected,
                            FRIEND_CHALLENGE_MIN_SELECTED_QUESTION_COUNT,
                        )
                        if (playable.length !== legacySelected.length) {
                            return badRequestResponse('One or more selected categories do not have enough clues')
                        }

                        const fallbackAutoFill = await selectBoardCategoryIds(
                            Math.max(desiredCount - legacySelected.length, 0),
                            {
                                excludeCategoryIds: [
                                    ...legacySelected,
                                    ...previousBoardCategoryIds.filter((categoryId) => !legacySelected.includes(categoryId)),
                                ],
                                minQuestionCount: FRIEND_CHALLENGE_MIN_SELECTED_QUESTION_COUNT,
                            },
                        )

                        boardCategoryIds = [...legacySelected, ...fallbackAutoFill]
                    }

                    if (boardCategoryIds.length < desiredCount) {
                        return badRequestResponse('Not enough eligible categories available to complete this custom board')
                    }
                } else {
                    boardCategoryIds = await selectBoardCategoryIds(desiredCount, {
                        excludeCategoryIds: previousBoardCategoryIds,
                        minQuestionCount: FRIEND_CHALLENGE_MIN_SELECTED_QUESTION_COUNT,
                    })
                    boardCategorySelections = []
                    if (boardCategoryIds.length < desiredCount) {
                        return badRequestResponse('Not enough eligible categories available for this challenge')
                    }
                }
            }

            const existing = await prisma.friendChallenge.findFirst({
                where: {
                    AND: [
                        {
                            OR: [
                                { challengerUserId: user.id, opponentUserId: opponentId },
                                { challengerUserId: opponentId, opponentUserId: user.id },
                            ],
                        },
                        {
                            OR: [
                                {
                                    status: FriendChallengeStatus.PENDING,
                                    expiresAt: { gt: now },
                                },
                                {
                                    status: FriendChallengeStatus.ACCEPTED,
                                },
                            ],
                        },
                    ],
                },
                include: buildChallengeInclude(),
                orderBy: { updatedAt: 'desc' },
            })

            if (existing) {
                return errorResponse(
                    'An active challenge already exists between these users',
                    409,
                    'ACTIVE_CHALLENGE_EXISTS',
                    {
                        activeChallenge: {
                            id: existing.id,
                            mode: existing.mode,
                            status: existing.status,
                            challengerUserId: existing.challengerUserId,
                            opponentUserId: existing.opponentUserId,
                            challengerDisplayName: existing.challenger.displayName,
                            opponentDisplayName: existing.opponent.displayName,
                        },
                    },
                )
            }

            const created = await prisma.$transaction(async (tx) => {
                const challenge = await tx.friendChallenge.create({
                    data: {
                        challengerUserId: user.id,
                        opponentUserId: opponentId,
                        mode,
                        message: message || null,
                        targetValue: targetValue ?? null,
                        status: FriendChallengeStatus.PENDING,
                        expiresAt: parsedExpiresAt ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
                    },
                })

                if (mode === FriendChallengeMode.GAME && boardCategoryIds.length > 0) {
                    const gameConfig = {
                        mode: 'custom',
                        categoryIds: boardCategoryIds,
                        categorySelections: boardCategorySelections,
                        rounds: { single: true, double: false, final: false },
                        preset: 'challenge',
                        friendChallengeId: challenge.id,
                        friendChallengeRole: 'CHALLENGER',
                        friendChallengeBoardCategoryIds: boardCategoryIds,
                        friendChallengeBoardCategoryId: boardCategoryIds[0],
                        friendChallengeBoardCategorySelections: boardCategorySelections,
                        friendChallengeCategorySelection: categorySelection,
                        spoilerProtection: {
                            enabled: false,
                            cutoffDate: null,
                        },
                    } as unknown as Prisma.InputJsonValue

                    await tx.game.create({
                        data: {
                            userId: user.id,
                            seed: nanoid(10),
                            config: gameConfig,
                            status: 'IN_PROGRESS',
                            currentRound: 'SINGLE',
                            currentScore: 0,
                            visibility: 'PRIVATE',
                            useKnowledgeCategories: false,
                        },
                    })
                }

                await tx.friendActivity.create({
                    data: {
                        actorUserId: user.id,
                        relatedUserId: opponentId,
                        challengeId: challenge.id,
                        activityType: FriendActivityType.CHALLENGE_CREATED,
                        metadata: {
                            challengeId: challenge.id,
                            mode,
                            targetValue,
                            categorySelection,
                            categoryCount: mode === FriendChallengeMode.GAME ? boardCategoryIds.length : undefined,
                            categoryIds: mode === FriendChallengeMode.GAME ? boardCategoryIds : undefined,
                            ...challengeParticipantMetadata(challenge),
                        },
                    },
                })

                return challenge
            })

            return jsonResponse({ challenge: created }, 201)
        }

        if (!challengeId) {
            return badRequestResponse('challengeId is required')
        }

        const challenge = await prisma.friendChallenge.findUnique({
            where: { id: challengeId },
        })

        if (!challenge) {
            return badRequestResponse('Challenge not found')
        }

        const isChallenger = challenge.challengerUserId === user.id
        const isOpponent = challenge.opponentUserId === user.id

        if (!isChallenger && !isOpponent) {
            return badRequestResponse('You are not part of this challenge')
        }

        if (challenge.status === FriendChallengeStatus.PENDING && challenge.expiresAt <= now) {
            await prisma.friendChallenge.update({
                where: { id: challenge.id },
                data: { status: FriendChallengeStatus.EXPIRED },
            })

            return badRequestResponse('This challenge has expired')
        }

        if (action === 'cancel') {
            if (!isChallenger) {
                return badRequestResponse('Only the challenger can cancel this challenge')
            }

            if (challenge.status !== FriendChallengeStatus.PENDING) {
                return badRequestResponse('Only pending challenges can be cancelled')
            }

            const updated = await prisma.$transaction(async (tx) => {
                const updatedChallenge = await tx.friendChallenge.update({
                    where: { id: challenge.id },
                    data: { status: FriendChallengeStatus.CANCELLED },
                })

                await tx.friendActivity.create({
                    data: {
                        actorUserId: user.id,
                        relatedUserId: challenge.opponentUserId,
                        challengeId: challenge.id,
                        activityType: FriendActivityType.CHALLENGE_CANCELLED,
                        metadata: {
                            challengeId: challenge.id,
                            ...challengeParticipantMetadata(challenge),
                        },
                    },
                })

                return updatedChallenge
            })

            return jsonResponse({ challenge: updated })
        }

        if (action === 'end') {
            if (
                challenge.status !== FriendChallengeStatus.PENDING
                && challenge.status !== FriendChallengeStatus.ACCEPTED
            ) {
                return badRequestResponse('Only pending or accepted challenges can be ended')
            }

            const relatedUserId = isChallenger ? challenge.opponentUserId : challenge.challengerUserId
            const updated = await prisma.$transaction(async (tx) => {
                const updatedChallenge = await tx.friendChallenge.update({
                    where: { id: challenge.id },
                    data: {
                        status: FriendChallengeStatus.CANCELLED,
                        respondedAt: challenge.respondedAt ?? now,
                    },
                })

                await tx.friendActivity.create({
                    data: {
                        actorUserId: user.id,
                        relatedUserId,
                        challengeId: challenge.id,
                        activityType: FriendActivityType.CHALLENGE_CANCELLED,
                        metadata: {
                            challengeId: challenge.id,
                            previousStatus: challenge.status,
                            endedByUserId: user.id,
                            ...challengeParticipantMetadata(challenge),
                        },
                    },
                })

                return updatedChallenge
            })

            return jsonResponse({ challenge: updated })
        }

        if (action === 'decline') {
            if (!isOpponent) {
                return badRequestResponse('Only the opponent can decline this challenge')
            }

            if (challenge.status !== FriendChallengeStatus.PENDING) {
                return badRequestResponse('Only pending challenges can be declined')
            }

            const updated = await prisma.$transaction(async (tx) => {
                const updatedChallenge = await tx.friendChallenge.update({
                    where: { id: challenge.id },
                    data: {
                        status: FriendChallengeStatus.DECLINED,
                        respondedAt: now,
                    },
                })

                await tx.friendActivity.create({
                    data: {
                        actorUserId: user.id,
                        relatedUserId: challenge.challengerUserId,
                        challengeId: challenge.id,
                        activityType: FriendActivityType.CHALLENGE_DECLINED,
                        metadata: {
                            challengeId: challenge.id,
                            ...challengeParticipantMetadata(challenge),
                        },
                    },
                })

                return updatedChallenge
            })

            return jsonResponse({ challenge: updated })
        }

        if (action === 'accept') {
            if (!isOpponent) {
                return badRequestResponse('Only the opponent can accept this challenge')
            }

            if (challenge.status !== FriendChallengeStatus.PENDING) {
                return badRequestResponse('Only pending challenges can be accepted')
            }

            const updated = await prisma.$transaction(async (tx) => {
                const updatedChallenge = await tx.friendChallenge.update({
                    where: { id: challenge.id },
                    data: {
                        status: FriendChallengeStatus.ACCEPTED,
                        respondedAt: now,
                    },
                })

                await tx.friendActivity.create({
                    data: {
                        actorUserId: user.id,
                        relatedUserId: challenge.challengerUserId,
                        challengeId: challenge.id,
                        activityType: FriendActivityType.CHALLENGE_ACCEPTED,
                        metadata: {
                            challengeId: challenge.id,
                            ...challengeParticipantMetadata(challenge),
                        },
                    },
                })

                return updatedChallenge
            })

            let launchGameId: string | null = null
            if (challenge.mode === FriendChallengeMode.GAME) {
                launchGameId = await ensureChallengeGameForUser({
                    challengeId: challenge.id,
                    userId: user.id,
                    role: 'OPPONENT',
                })
            }

            return jsonResponse({ challenge: updated, launchGameId })
        }

        if (action === 'launch') {
            if (challenge.mode !== FriendChallengeMode.GAME) {
                return badRequestResponse('Only game-mode challenges can be launched')
            }

            if (challenge.status !== FriendChallengeStatus.ACCEPTED && challenge.status !== FriendChallengeStatus.COMPLETED) {
                return badRequestResponse('Challenge must be accepted before launching')
            }

            const role: ChallengeRole = challenge.challengerUserId === user.id ? 'CHALLENGER' : 'OPPONENT'
            const gameId = await ensureChallengeGameForUser({
                challengeId: challenge.id,
                userId: user.id,
                role,
            })

            return jsonResponse({ challengeId: challenge.id, gameId })
        }

        if (action === 'complete') {
            if (!isChallenger && !isOpponent) {
                return badRequestResponse('Only participants can complete this challenge')
            }

            if (challenge.mode === FriendChallengeMode.GAME) {
                return badRequestResponse('Game-mode challenges are completed automatically')
            }

            if (challenge.status !== FriendChallengeStatus.ACCEPTED) {
                return badRequestResponse('Only accepted challenges can be completed')
            }

            if (challengerScore === undefined || opponentScore === undefined) {
                return badRequestResponse('Both challengerScore and opponentScore are required')
            }

            if (
                Number.isNaN(challengerScore) ||
                Number.isNaN(opponentScore)
            ) {
                return badRequestResponse('Invalid score values')
            }

            const winnerUserId =
                challengerScore > opponentScore
                    ? challenge.challengerUserId
                    : opponentScore > challengerScore
                        ? challenge.opponentUserId
                        : null

            const updated = await prisma.$transaction(async (tx) => {
                const updatedChallenge = await tx.friendChallenge.update({
                    where: { id: challenge.id },
                    data: {
                        status: FriendChallengeStatus.COMPLETED,
                        challengerScore,
                        opponentScore,
                        winnerUserId,
                        completedAt: now,
                    },
                })

                await tx.friendActivity.create({
                    data: {
                        actorUserId: user.id,
                        relatedUserId: isChallenger ? challenge.opponentUserId : challenge.challengerUserId,
                        challengeId: challenge.id,
                        activityType: FriendActivityType.CHALLENGE_COMPLETED,
                        metadata: {
                            challengeId: challenge.id,
                            challengerScore,
                            opponentScore,
                            ...challengeParticipantMetadata(challenge),
                        },
                    },
                })

                return updatedChallenge
            })

            return jsonResponse({ challenge: updated })
        }

        return badRequestResponse('Unsupported action')
    } catch (error) {
        if (
            action === 'create'
            && error instanceof Prisma.PrismaClientKnownRequestError
            && error.code === 'P2002'
        ) {
            return errorResponse(
                'An active challenge already exists between these users',
                409,
                'ACTIVE_CHALLENGE_EXISTS',
            )
        }
        return serverErrorResponse('Error handling friend challenge', error)
    }
})

export const dynamic = 'force-dynamic'

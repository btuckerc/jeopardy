import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import {
    jsonResponse,
    notFoundResponse,
    serverErrorResponse,
    badRequestResponse,
    unauthorizedResponse,
    forbiddenResponse
} from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import type { Prisma } from '@prisma/client'
import {
    getGameSpoilerPolicy,
    computeUserEffectiveCutoff,
    buildSimpleAirDateCondition,
    wouldViolateSpoilerPolicy,
    type SpoilerPolicy
} from '@/lib/spoiler-utils'
import {
    getFinalJeopardyCacheKey,
    getCachedFinalJeopardy,
    setCachedFinalJeopardy,
    type CachedFinalJeopardy
} from '@/lib/game-cache'
import {
    canPlayGameContentSource,
    getPlayableQuestionWhere,
    parseBoardSnapshot,
    resolveRequestedContentSource,
    shouldApplySpoilerFilter,
} from '@/lib/question-policy'
import type { QuestionSource } from '@prisma/client'

export const dynamic = 'force-dynamic'

// Step-level timing helper for performance analysis
function createTimer(label: string) {
    const times: { step: string; ms: number }[] = []
    let lastTime = performance.now()
    return {
        mark(step: string) {
            const now = performance.now()
            times.push({ step, ms: Math.round(now - lastTime) })
            lastTime = now
        },
        log() {
            const total = times.reduce((sum, t) => sum + t.ms, 0)
            console.log(`[PERF] ${label}: ${total}ms total`, times.map(t => `${t.step}=${t.ms}ms`).join(', '))
        }
    }
}

// Deterministic hash from seed string to number
function hashSeed(seed: string): number {
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
}

type KnowledgeCategory =
    | 'GEOGRAPHY_AND_HISTORY'
    | 'ENTERTAINMENT'
    | 'ARTS_AND_LITERATURE'
    | 'SCIENCE_AND_NATURE'
    | 'SPORTS_AND_LEISURE'
    | 'GENERAL_KNOWLEDGE'

/**
 * GET /api/game/final
 * 
 * Returns a Final Jeopardy question for a game.
 * OPTIMIZED: Uses count + skip for O(1) selection instead of loading all questions.
 * 
 * Query parameters:
 * - gameId: (optional) If provided, uses the game's stored spoiler policy + seed for determinism
 * - questionId: (optional) For fetching a specific question (resume)
 * - mode: 'random' | 'knowledge' | 'custom' | 'date'
 * - finalCategoryMode: 'shuffle' | 'byDate' | 'specificCategory'
 * - finalCategoryId: (for specificCategory mode) category ID
 * - categories: (for knowledge mode) comma-separated knowledge category names
 * - categoryIds: (for custom mode) comma-separated category IDs
 * - date: (for date mode or byDate finalCategoryMode) ISO date string
 */
export const GET = withInstrumentation(async (request: NextRequest) => {
    const timer = createTimer('/api/game/final')
    try {
        const searchParams = request.nextUrl.searchParams
        const gameId = searchParams.get('gameId')
        const mode = searchParams.get('mode')
        const finalCategoryMode = searchParams.get('finalCategoryMode') || 'shuffle'
        const revealAnswers = searchParams.get('reveal') === 'true'
        const date = searchParams.get('date')
        const finalCategoryId = searchParams.get('finalCategoryId')
        const questionId = searchParams.get('questionId') // For fetching a specific question (resume)

        // Authenticate and authorize BEFORE checking cache
        const appUser = await getAppUser()
        timer.mark('auth')
        const userId = appUser?.id
        const isAdmin = appUser?.role === 'ADMIN'

        // Determine the effective spoiler policy and contentSource
        let spoilerPolicy: SpoilerPolicy
        let gameSeed: string | null = null
        let canRevealAnswers = false
        let userCanAccessGame = true
        let contentSource: QuestionSource = resolveRequestedContentSource(searchParams.get('source'), isAdmin)
        let gameRecord: {
            userId: string
            opponentUserId: string | null
            seed: string | null
            visibility: string
            status: string
            contentSource: QuestionSource
            config: Prisma.JsonValue
        } | null = null

        if (gameId) {
            gameRecord = await prisma.game.findUnique({
                where: { id: gameId },
                select: {
                    userId: true,
                    opponentUserId: true,
                    seed: true,
                    visibility: true,
                    status: true,
                    contentSource: true,
                    config: true
                }
            })
            if (!gameRecord) {
                return notFoundResponse('Game not found')
            }

            const isOwner = !!userId && gameRecord.userId === userId
            const isOpponent = !!userId && gameRecord.opponentUserId === userId
            canRevealAnswers = isOwner || isOpponent || isAdmin
            userCanAccessGame = gameRecord.visibility !== 'PRIVATE' || canRevealAnswers

            if (!userCanAccessGame) {
                if (!userId) {
                    return unauthorizedResponse('Please sign in to access this game')
                }
                return forbiddenResponse('You do not have access to this game')
            }

            if (revealAnswers && !canRevealAnswers) {
                if (!userId) {
                    return unauthorizedResponse('Please sign in to reveal this game\'s answers')
                }
                return forbiddenResponse('You do not have access to this game board\'s answers')
            }

            contentSource = gameRecord.contentSource
            const playPolicy = canPlayGameContentSource(contentSource, gameRecord.status, isAdmin)
            if (!playPolicy.allowed) {
                return jsonResponse(
                    {
                        error: 'This legacy game has been retired. Your score, history, and stats remain preserved—start a new game from the Original question bank.',
                        legacyRetired: true
                    },
                    410
                )
            }

            spoilerPolicy = shouldApplySpoilerFilter(contentSource)
                ? await getGameSpoilerPolicy(gameId)
                : { enabled: false, cutoffDate: null }
            gameSeed = gameRecord.seed ?? null
        } else if (userId && shouldApplySpoilerFilter(contentSource)) {
            spoilerPolicy = await computeUserEffectiveCutoff(userId)
        } else {
            spoilerPolicy = { enabled: false, cutoffDate: null }
        }
        timer.mark('spoilerPolicy')
        const shouldRevealAnswers = revealAnswers && (canRevealAnswers || (!gameId && isAdmin))

        // Derive authoritative mode/config parameters from stored Game.config when gameId is present
        const storedCfg = (gameRecord?.config && typeof gameRecord.config === 'object' && !Array.isArray(gameRecord.config)
            ? gameRecord.config
            : {}) as Record<string, unknown>
        const effectiveMode = (gameRecord && typeof storedCfg.mode === 'string') ? storedCfg.mode : mode
        const effectiveDate = (gameRecord && typeof storedCfg.date === 'string') ? storedCfg.date : date
        const effectiveFinalCategoryMode =
            (gameRecord && typeof storedCfg.finalCategoryMode === 'string')
                ? storedCfg.finalCategoryMode
                : finalCategoryMode
        const effectiveFinalCategoryId =
            (gameRecord && typeof storedCfg.finalCategoryId === 'string')
                ? storedCfg.finalCategoryId
                : finalCategoryId
        const effectiveCategories: string[] =
            gameRecord && Array.isArray(storedCfg.categories)
                ? storedCfg.categories.filter((c): c is string => typeof c === 'string')
                : searchParams.get('categories')?.split(',').filter(Boolean) || []
        const effectiveCategoryIds: string[] =
            gameRecord && Array.isArray(storedCfg.categoryIds)
                ? storedCfg.categoryIds.filter((c): c is string => typeof c === 'string')
                : searchParams.get('categoryIds')?.split(',').filter(Boolean) || []

        // Resolve pinned Final question ID: stored game snapshot/pin always takes precedence.
        // For non-admin gameId requests, never honor an arbitrary caller-supplied questionId.
        const snapshotFinalId = gameRecord
            ? parseBoardSnapshot(gameRecord.config).FINAL
                ?? (typeof storedCfg.finalJeopardyQuestionId === 'string'
                    ? storedCfg.finalJeopardyQuestionId
                    : null)
            : null

        const isNonActiveGameReview =
            Boolean(gameId && gameRecord) &&
            gameRecord!.status !== 'IN_PROGRESS'

        let resolvedQuestionId: string | null = snapshotFinalId || (!gameId || isAdmin ? questionId : null)

        // For non-active games (COMPLETED or ABANDONED) without a pinned Final, resolve ONLY
        // from an already-played FINAL GameQuestion (never probe the general pool or write a snapshot).
        if (isNonActiveGameReview && !resolvedQuestionId) {
            const playedFinal = await prisma.gameQuestion.findFirst({
                where: {
                    gameId: gameId!,
                    question: { round: 'FINAL', source: contentSource }
                },
                select: { questionId: true }
            })
            if (!playedFinal) {
                timer.log()
                return notFoundResponse('No Final Jeopardy question was played in this game')
            }
            resolvedQuestionId = playedFinal.questionId
        }

        // Check cache AFTER authorization and contentSource resolution (never cache admin or completed review)
        const allowCache = !isAdmin && gameRecord?.status !== 'COMPLETED'
        if (!resolvedQuestionId && allowCache) {
            const cacheKey = getFinalJeopardyCacheKey({ 
                gameId, 
                seed: gameSeed,
                mode: effectiveMode, 
                contentSource,
                date: effectiveDate, 
                finalCategoryMode: effectiveFinalCategoryMode, 
                finalCategoryId: effectiveFinalCategoryId,
                revealAnswers: shouldRevealAnswers,
                isAdmin
            })
            if (cacheKey) {
                const cached = getCachedFinalJeopardy(cacheKey)
                if (cached) {
                    const stillPublished = await prisma.question.findFirst({
                        where: { id: cached.id, source: contentSource, publishStatus: 'PUBLISHED' },
                        select: { id: true }
                    })
                    if (stillPublished) {
                        timer.mark('cacheHit')
                        timer.log()
                        return jsonResponse(cached)
                    }
                }
            }
            timer.mark('cacheMiss')
        }

        // If a specific/snapshotted question ID is provided, fetch that question directly
        if (resolvedQuestionId) {
            const question = await prisma.question.findUnique({
                where: { id: resolvedQuestionId },
                include: {
                    category: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            })
            timer.mark('findUniqueQuestion')

            if (!question) {
                timer.log()
                return notFoundResponse('Final Jeopardy question not found')
            }

            if (
                !isAdmin &&
                (
                    question.source !== contentSource ||
                    question.round !== 'FINAL' ||
                    (gameRecord?.status !== 'COMPLETED' && question.publishStatus !== 'PUBLISHED')
                )
            ) {
                return forbiddenResponse('Question does not belong to this game content pool')
            }

            // When resuming, verify the stored question is still compatible with the spoiler policy
            if (shouldApplySpoilerFilter(contentSource) && wouldViolateSpoilerPolicy(question.airDate, spoilerPolicy)) {
                const cutoffStr = spoilerPolicy.cutoffDate?.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
                timer.log()
                return badRequestResponse(
                    `This Final Jeopardy question is from an episode that would violate the game's spoiler protection ` +
                    `(blocking ${cutoffStr} and later). The game cannot be resumed with current settings.`
                )
            }

            timer.mark('done')
            timer.log()
            return jsonResponse({
                id: question.id,
                question: question.question,
                answer: shouldRevealAnswers ? question.answer : null,
                category: {
                    id: question.category.id,
                    name: question.category.name
                }
            })
        }

        // Build the airDate condition from the spoiler policy
        const airDateCondition = buildSimpleAirDateCondition(spoilerPolicy)
        const baseSourceWhere = getPlayableQuestionWhere(contentSource)

        // Base where clause for Final Jeopardy questions (always scoped to contentSource + PUBLISHED)
        let whereClause: Prisma.QuestionWhereInput = {
            ...baseSourceWhere,
            round: 'FINAL',
            ...(airDateCondition ? { airDate: airDateCondition } : {})
        }

        // Apply mode-specific filters
        switch (effectiveMode) {
            case 'knowledge': {
                if (effectiveCategories.length > 0) {
                    whereClause = {
                        ...whereClause,
                        knowledgeCategory: {
                            in: effectiveCategories as KnowledgeCategory[]
                        }
                    }
                }
                break
            }

            case 'custom': {
                // Only filter Final by regular-board categoryIds if NOT explicitly in 'shuffle' (random Final) mode
                if (effectiveFinalCategoryMode !== 'shuffle' && effectiveCategoryIds.length > 0) {
                    whereClause = {
                        ...whereClause,
                        categoryId: {
                            in: effectiveCategoryIds
                        }
                    }
                }
                break
            }

            case 'date': {
                if (effectiveDate) {
                    // For date mode, we want the Final Jeopardy from that specific episode/pack within contentSource
                    whereClause = {
                        ...baseSourceWhere,
                        round: 'FINAL',
                        airDate: new Date(effectiveDate)
                    }
                }
                break
            }
        }

        // Handle Final Jeopardy category selection mode
        if (effectiveFinalCategoryMode === 'specificCategory' && effectiveFinalCategoryId) {
            whereClause = {
                ...whereClause,
                categoryId: effectiveFinalCategoryId
            }
        } else if (effectiveFinalCategoryMode === 'byDate' && effectiveDate) {
            // For byDate mode, override to get the exact episode/pack's Final Jeopardy within contentSource
            whereClause = {
                ...baseSourceWhere,
                round: 'FINAL',
                airDate: new Date(effectiveDate)
            }
        }

        // OPTIMIZED: Use count + deterministic skip instead of loading all questions
        const totalCount = await prisma.question.count({ where: whereClause })
        timer.mark(`countQuestions(${totalCount})`)

        if (totalCount === 0) {
            timer.log()
            if (spoilerPolicy.enabled && spoilerPolicy.cutoffDate) {
                const cutoffStr = spoilerPolicy.cutoffDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
                return notFoundResponse(
                    `No Final Jeopardy questions found matching the criteria. Your spoiler protection blocks questions from ${cutoffStr} and later. ` +
                    `Try selecting an earlier episode date or adjusting your spoiler settings.`
                )
            }
            return notFoundResponse('No Final Jeopardy questions found matching the criteria')
        }

        // Determine skip index - deterministic if we have a game seed, random otherwise
        let skipIndex: number
        if (gameSeed) {
            // Use game seed + 'FINAL' to get deterministic but unique selection for FJ
            skipIndex = hashSeed(gameSeed + 'FINAL') % totalCount
        } else {
            skipIndex = Math.floor(Math.random() * totalCount)
        }

        // Fetch just the one question using skip
        const selectedQuestion = await prisma.question.findFirst({
            where: whereClause,
            orderBy: { id: 'asc' }, // Stable ordering for deterministic skip
            skip: skipIndex,
            include: {
                category: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        })
        timer.mark('fetchSingleQuestion')

        if (!selectedQuestion) {
            timer.log()
            return notFoundResponse('Failed to select Final Jeopardy question')
        }

        const result: CachedFinalJeopardy = {
            id: selectedQuestion.id,
            question: selectedQuestion.question,
            answer: shouldRevealAnswers ? selectedQuestion.answer : null,
            category: {
                id: selectedQuestion.category.id,
                name: selectedQuestion.category.name
            }
        }

        // Atomically persist pinned Final question ID in Game.config.boardSnapshot without clobbering concurrent fields
        let finalResult: CachedFinalJeopardy = result
        if (gameId && gameRecord && gameRecord.status === 'IN_PROGRESS') {
            const payload = JSON.stringify(selectedQuestion.id)
            const updatedRows = await prisma.$executeRaw`
                UPDATE "Game"
                SET "config" = jsonb_set(
                    CASE
                        WHEN jsonb_typeof(COALESCE("config", '{}'::jsonb) -> 'boardSnapshot') = 'object'
                            THEN COALESCE("config", '{}'::jsonb)
                        ELSE jsonb_set(COALESCE("config", '{}'::jsonb), '{boardSnapshot}', '{}'::jsonb, true)
                    END,
                    '{boardSnapshot,FINAL}',
                    ${payload}::jsonb,
                    true
                )
                WHERE "id" = ${gameId}
                  AND (COALESCE("config", '{}'::jsonb) -> 'boardSnapshot' ->> 'FINAL') IS NULL
            `
            // If another concurrent request won the snapshot write, return the winning stored Final clue
            if (Number(updatedRows) === 0) {
                const freshGame = await prisma.game.findUnique({
                    where: { id: gameId },
                    select: { config: true }
                })
                const winningFinalId = parseBoardSnapshot(freshGame?.config).FINAL
                if (winningFinalId && winningFinalId !== selectedQuestion.id) {
                    const winningQuestion = await prisma.question.findFirst({
                        where: {
                            id: winningFinalId,
                            source: contentSource,
                            round: 'FINAL',
                            ...(!isAdmin ? { publishStatus: 'PUBLISHED' } : {}),
                        },
                        include: { category: { select: { id: true, name: true } } }
                    })
                    if (!winningQuestion) {
                        return forbiddenResponse('Pinned Final question is no longer available in this game content pool')
                    }
                    finalResult = {
                        id: winningQuestion.id,
                        question: winningQuestion.question,
                        answer: shouldRevealAnswers ? winningQuestion.answer : null,
                        category: {
                            id: winningQuestion.category.id,
                            name: winningQuestion.category.name
                        }
                    }
                }
            }
        }

        // Cache the result for future requests (never cache admin or completed review)
        if (allowCache) {
            const cacheKey = getFinalJeopardyCacheKey({ 
                gameId, 
                seed: gameSeed, 
                mode: effectiveMode, 
                contentSource,
                date: effectiveDate, 
                finalCategoryMode: effectiveFinalCategoryMode, 
                finalCategoryId: effectiveFinalCategoryId,
                revealAnswers: shouldRevealAnswers,
                isAdmin
            })
            if (cacheKey) {
                setCachedFinalJeopardy(cacheKey, finalResult)
            }
        }

        timer.mark('done')
        timer.log()
        return jsonResponse(finalResult)
    } catch (error) {
        timer.mark('error')
        timer.log()
        return serverErrorResponse('Failed to load Final Jeopardy', error)
    }
})

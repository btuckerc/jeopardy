/**
 * Pre-Cutover Utility: Snapshot Active IN_PROGRESS Legacy Games
 *
 * Safely pins exact legacy question IDs ONLY for games whose board selection is
 * explicitly deterministic from their stored Game.config (custom categorySelections /
 * categoryIds, explicit episode date, or already-recorded finalJeopardyQuestionId).
 *
 * Random/knowledge seeded legacy games are intentionally left untouched for
 * source-isolated first-render capture inside /api/categories/game (because
 * LEGACY_JEOPARDY queries are strictly isolated from ORIGINAL_ENGINE and
 * ENABLE_JARCHIVE_SYNC=false freezes the legacy pool, so their seeded boards
 * cannot reshuffle). This avoids fabricating mismatched categories or bypassing
 * spoiler protection policies.
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { parseBoardSnapshot } from '../lib/question-policy'
import { buildSimpleAirDateCondition, getGameSpoilerPolicy } from '../lib/spoiler-utils'

interface StoredSelection {
    categoryId: string
    airDate?: string | null
}

async function main() {
    const prisma = new PrismaClient()
    try {
        const legacyGames = await prisma.game.findMany({
            where: {
                contentSource: 'LEGACY_JEOPARDY',
                status: 'IN_PROGRESS',
            },
            include: {
                questions: {
                    include: {
                        question: {
                            select: {
                                id: true,
                                round: true,
                                categoryId: true,
                                airDate: true,
                            },
                        },
                    },
                },
            },
        })

        console.log(`Found ${legacyGames.length} IN_PROGRESS LEGACY_JEOPARDY games to inspect.`)
        let snapshotted = 0
        let skippedAlreadyPinned = 0
        let deferredToFirstRender = 0

        for (const game of legacyGames) {
            const existing = parseBoardSnapshot(game.config)
            const cfg = (game.config && typeof game.config === 'object' && !Array.isArray(game.config)
                ? game.config
                : {}) as Record<string, unknown>
            const mode = typeof cfg.mode === 'string' ? cfg.mode : 'random'
            const spoilerPolicy = await getGameSpoilerPolicy(game.id)
            const airDateCondition = buildSimpleAirDateCondition(spoilerPolicy)
            const patch: { SINGLE?: string[]; DOUBLE?: string[]; FINAL?: string } = {}

            // 1. Preserve explicit FINAL pin if missing from snapshot
            if (!existing.FINAL) {
                const answeredFinal = game.questions.find((gq) => gq.question.round === 'FINAL')
                if (answeredFinal) {
                    patch.FINAL = answeredFinal.questionId
                } else if (typeof cfg.finalJeopardyQuestionId === 'string') {
                    patch.FINAL = cfg.finalJeopardyQuestionId
                }
            }

            // 2. Date-mode games: exact episode clues for that exact airDate (respecting spoiler cutoff)
            if (mode === 'date' && typeof cfg.date === 'string') {
                const startOfDay = new Date(`${cfg.date.slice(0, 10)}T00:00:00.000Z`)
                const endOfDay = new Date(`${cfg.date.slice(0, 10)}T23:59:59.999Z`)
                const dateAllowed =
                    !spoilerPolicy.enabled ||
                    !spoilerPolicy.cutoffDate ||
                    startOfDay < spoilerPolicy.cutoffDate

                if (dateAllowed) {
                    for (const round of ['SINGLE', 'DOUBLE'] as const) {
                        if (existing[round]?.length) continue
                        const clues = await prisma.question.findMany({
                            where: {
                                source: 'LEGACY_JEOPARDY',
                                publishStatus: 'PUBLISHED',
                                round,
                                airDate: { gte: startOfDay, lte: endOfDay },
                            },
                            orderBy: [{ categoryId: 'asc' }, { value: 'asc' }],
                            select: { id: true, categoryId: true },
                        })
                        // Cap each category at 5 clues to match /api/categories/game date-mode selector
                        const perCatCount = new Map<string, number>()
                        const cappedIds: string[] = []
                        for (const c of clues) {
                            const n = perCatCount.get(c.categoryId) || 0
                            if (n < 5) {
                                perCatCount.set(c.categoryId, n + 1)
                                cappedIds.push(c.id)
                            }
                        }
                        if (cappedIds.length > 0) {
                            patch[round] = cappedIds
                        }
                    }
                    if (!existing.FINAL && !patch.FINAL) {
                        const epFinal = await prisma.question.findFirst({
                            where: {
                                source: 'LEGACY_JEOPARDY',
                                publishStatus: 'PUBLISHED',
                                round: 'FINAL',
                                airDate: { gte: startOfDay, lte: endOfDay },
                            },
                            select: { id: true },
                        })
                        if (epFinal) patch.FINAL = epFinal.id
                    }
                }
            }

            // 3. Custom-mode games: mirror /api/categories/game single-episode & spoiler selection
            if (mode === 'custom') {
                const rawSelections = Array.isArray(cfg.categorySelections)
                    ? (cfg.categorySelections as StoredSelection[])
                    : []
                const rawCategoryIds = Array.isArray(cfg.categoryIds)
                    ? cfg.categoryIds.filter((id): id is string => typeof id === 'string')
                    : []
                const selections: StoredSelection[] =
                    rawSelections.length > 0
                        ? rawSelections
                        : rawCategoryIds.map((categoryId) => ({ categoryId }))

                if (selections.length > 0) {
                    for (const round of ['SINGLE', 'DOUBLE'] as const) {
                        if (existing[round]?.length) continue
                        const ids: string[] = []
                        for (const sel of selections) {
                            if (sel.airDate) {
                                const clues = await prisma.question.findMany({
                                    where: {
                                        source: 'LEGACY_JEOPARDY',
                                        publishStatus: 'PUBLISHED',
                                        categoryId: sel.categoryId,
                                        round,
                                        airDate: {
                                            gte: new Date(`${sel.airDate.slice(0, 10)}T00:00:00.000Z`),
                                            lte: new Date(`${sel.airDate.slice(0, 10)}T23:59:59.999Z`),
                                            ...(airDateCondition ?? {}),
                                        },
                                    },
                                    orderBy: { value: 'asc' },
                                    take: 5,
                                    select: { id: true },
                                })
                                clues.forEach((c) => ids.push(c.id))
                                continue
                            }

                            // Prefer the episode airDate of an already-answered GameQuestion in this category+round
                            const answeredInCategory =
                                game.questions.find(
                                    (gq) =>
                                        gq.answered &&
                                        gq.question.categoryId === sel.categoryId &&
                                        gq.question.round === round &&
                                        gq.question.airDate !== null
                                ) ??
                                game.questions.find(
                                    (gq) =>
                                        gq.question.categoryId === sel.categoryId &&
                                        gq.question.round === round &&
                                        gq.question.airDate !== null
                                )
                            let bestDate: Date | null = answeredInCategory?.question.airDate ?? null

                            if (!bestDate) {
                                // Match /api/categories/game: pick single episode with >= 5 clues (or most clues) within spoiler policy
                                const dateGroups = await prisma.question.groupBy({
                                    by: ['airDate'],
                                    where: {
                                        source: 'LEGACY_JEOPARDY',
                                        publishStatus: 'PUBLISHED',
                                        categoryId: sel.categoryId,
                                        round,
                                        airDate: airDateCondition
                                            ? { not: null, ...airDateCondition }
                                            : { not: null },
                                    },
                                    _count: { id: true },
                                    orderBy: { _count: { id: 'desc' } },
                                })
                                bestDate =
                                    dateGroups.find((d) => d._count.id >= 5)?.airDate ??
                                    dateGroups[0]?.airDate ??
                                    null
                            }

                            const clues = await prisma.question.findMany({
                                where: {
                                    source: 'LEGACY_JEOPARDY',
                                    publishStatus: 'PUBLISHED',
                                    categoryId: sel.categoryId,
                                    round,
                                    ...(bestDate
                                        ? { airDate: bestDate }
                                        : airDateCondition
                                          ? { airDate: airDateCondition }
                                          : {}),
                                },
                                orderBy: { value: 'asc' },
                                take: 5,
                                select: { id: true },
                            })
                            clues.forEach((c) => ids.push(c.id))
                        }
                        if (ids.length > 0) {
                            patch[round] = ids
                        }
                    }
                }
            }

            if (Object.keys(patch).length > 0) {
                // Atomically patch ONLY missing boardSnapshot keys via jsonb_set so concurrent
                // Final wagers, stages, or live snapshot writes are never overwritten.
                for (const key of ['SINGLE', 'DOUBLE', 'FINAL'] as const) {
                    const val = patch[key]
                    if (!val) continue
                    const payload = JSON.stringify(val)
                    const pathKey = `{boardSnapshot,${key}}`
                    await prisma.$executeRaw`
                        UPDATE "Game"
                        SET "config" = jsonb_set(
                            CASE
                                WHEN jsonb_typeof(COALESCE("config", '{}'::jsonb) -> 'boardSnapshot') = 'object'
                                    THEN COALESCE("config", '{}'::jsonb)
                                ELSE jsonb_set(COALESCE("config", '{}'::jsonb), '{boardSnapshot}', '{}'::jsonb, true)
                            END,
                            ${pathKey}::text[],
                            ${payload}::jsonb,
                            true
                        )
                        WHERE "id" = ${game.id}
                          AND (COALESCE("config", '{}'::jsonb) -> 'boardSnapshot' -> ${key}) IS NULL
                    `
                }
                snapshotted++
            } else if (existing.SINGLE?.length || existing.DOUBLE?.length || existing.FINAL) {
                skippedAlreadyPinned++
            } else {
                // Random/knowledge seeded legacy games stay untouched so /api/categories/game
                // reconstructs their exact spoiler- & seed-matched board on next load and pins it atomically.
                deferredToFirstRender++
            }
        }

        console.log(
            `✓ Snapshotted ${snapshotted} legacy games (${skippedAlreadyPinned} already pinned, ${deferredToFirstRender} seeded/random games deferred to source-isolated first-render capture).`
        )
    } finally {
        await prisma.$disconnect()
    }
}

main().catch((err) => {
    console.error('Snapshot failed:', err)
    process.exit(1)
})

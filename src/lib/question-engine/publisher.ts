/**
 * Clean-Room Pack Quarantine, Merkle Root Finalization, & Database Publisher
 *
 * Bridges air-gapped generated packs -> BlindOverlapGate -> Merkle Root -> DB / JSON Manifest.
 */

import crypto from 'crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { BlindOverlapGate, type ReferenceCorpusEntry } from './overlap-gate'
import { buildMerkleTree, verifyProvenanceReceipt } from './provenance'
import { PROMPT_TEMPLATE_HASH } from './generator'
import { getActiveChallengeDate } from '../daily-challenge-utils'
import {
    ENGINE_VERSION,
    type GeneratedCategoryPack,
    type GenerationRunManifest,
} from './types'

export interface FinalizeRunResult {
    manifest: GenerationRunManifest
    rejectedCategories: Array<{ categoryName: string; reason: string }>
    rejectedCluesCount: number
}

/**
 * Screen generated category packs through the blind PASS/REJECT overlap gate,
 * discard any failing category or clue, compute the run Merkle root & inclusion proofs,
 * and return an immutable GenerationRunManifest ready for publication.
 */
export function finalizeGenerationRun(params: {
    packs: GeneratedCategoryPack[]
    modelId: string
    packReleaseDate: string // YYYY-MM-DD
    promptTemplateHash?: string
    referenceCorpus: ReferenceCorpusEntry[]
    draftStats?: {
        totalDrafted: number
        totalPassedDeterministic: number
        totalPassedBlindSolver: number
    }
}): FinalizeRunResult {
    if (!params.referenceCorpus || params.referenceCorpus.length === 0) {
        throw new Error(
            'Refusing to finalize generation run without a non-empty reference corpus for blind overlap screening'
        )
    }

    const gate = new BlindOverlapGate(params.referenceCorpus)
    if (gate.indexedCount === 0) {
        throw new Error('Reference corpus contained zero valid entries after indexing')
    }
    const approvedPacks: GeneratedCategoryPack[] = []
    const rejectedCategories: Array<{ categoryName: string; reason: string }> = []
    let rejectedCluesCount = 0

    for (const pack of params.packs) {
        // 1. Screen category selection & arrangement
        const catCheck = gate.screenCategorySet(
            pack.categoryName,
            pack.clues.map((c) => c.answer)
        )
        if (!catCheck.passed) {
            rejectedCategories.push({ categoryName: pack.categoryName, reason: catCheck.reason })
            rejectedCluesCount += pack.clues.length
            continue
        }

        // 2. Screen every individual clue
        const screenedClues = []
        let packFailed = false
        for (const clue of pack.clues) {
            const check = gate.screenClue({
                question: clue.question,
                answer: clue.answer,
                categoryName: pack.categoryName,
            })
            if (!check.passed) {
                rejectedCluesCount += pack.clues.length
                packFailed = true
                rejectedCategories.push({
                    categoryName: pack.categoryName,
                    reason: `${check.reason} (sim=${check.maxClueSimilarity})`,
                })
                break
            }
            screenedClues.push({
                ...clue,
                provenance: {
                    ...clue.provenance,
                    overlapMaxScore: check.maxClueSimilarity,
                    overlapPassed: true,
                },
            })
        }

        if (!packFailed && screenedClues.length > 0) {
            approvedPacks.push({
                ...pack,
                clues: screenedClues,
            })
        }
    }

    // 3. Build Merkle tree across every approved clue's merkleLeafHash
    const allClues = approvedPacks.flatMap((p) => p.clues)
    const leafHashes = allClues.map((c) => c.provenance.merkleLeafHash)
    const { root: merkleRoot, proofs } = buildMerkleTree(leafHashes)

    let leafIdx = 0
    for (const pack of approvedPacks) {
        for (const clue of pack.clues) {
            clue.provenance.merkleProof = proofs[leafIdx++]
        }
    }

    // 4. Tally distribution stats
    const byKnowledgeCategory: Record<string, number> = {}
    const byRound: Record<string, number> = {}
    for (const clue of allClues) {
        byKnowledgeCategory[clue.knowledgeCategory] =
            (byKnowledgeCategory[clue.knowledgeCategory] || 0) + 1
        byRound[clue.round] = (byRound[clue.round] || 0) + 1
    }

    const runId = crypto.randomUUID()
    const manifest: GenerationRunManifest = {
        runId,
        engineVersion: ENGINE_VERSION,
        modelId: params.modelId,
        promptTemplateHash: params.promptTemplateHash || PROMPT_TEMPLATE_HASH,
        packReleaseDate: params.packReleaseDate,
        createdAt: new Date().toISOString(),
        merkleRoot,
        screeningCorpusCount: gate.indexedCount,
        screeningCorpusHash: gate.corpusHash,
        stats: {
            totalDrafted: params.draftStats?.totalDrafted ?? allClues.length + rejectedCluesCount,
            totalPassedDeterministic:
                params.draftStats?.totalPassedDeterministic ?? allClues.length + rejectedCluesCount,
            totalPassedBlindSolver:
                params.draftStats?.totalPassedBlindSolver ?? 0,
            totalRejectedOverlap: rejectedCluesCount,
            totalPublished: allClues.length,
            byKnowledgeCategory,
            byRound,
        },
        categories: approvedPacks,
    }

    return {
        manifest,
        rejectedCategories,
        rejectedCluesCount,
    }
}

/**
 * Cryptographically verify EVERY clue in a GenerationRunManifest before publishing.
 */
export function verifyRunManifest(manifest: GenerationRunManifest): {
    valid: boolean
    verifiedClues: number
    errors: string[]
} {
    const errors: string[] = []
    let verifiedClues = 0

    if (!manifest.screeningCorpusCount || manifest.screeningCorpusCount <= 0 || !manifest.screeningCorpusHash) {
        errors.push('Manifest lacks non-empty blind overlap screening corpus metadata')
    }

    const orderedLeafHashes: string[] = []
    const seenReceiptHashes = new Set<string>()
    let totalClues = 0

    for (const pack of manifest.categories) {
        for (const clue of pack.clues) {
            totalClues++
            orderedLeafHashes.push(clue.provenance.merkleLeafHash)
            if (seenReceiptHashes.has(clue.provenance.receiptHash)) {
                errors.push(
                    `[${pack.categoryName} / ${clue.answer}] duplicate receiptHash detected in manifest`
                )
            }
            seenReceiptHashes.add(clue.provenance.receiptHash)

            if (clue.categoryName !== pack.categoryName) {
                errors.push(
                    `[${pack.categoryName} / ${clue.answer}] category mismatch: pack="${pack.categoryName}" vs clue="${clue.categoryName}"`
                )
            }
            if (clue.round !== pack.round) {
                errors.push(
                    `[${pack.categoryName} / ${clue.answer}] round mismatch: pack="${pack.round}" vs clue="${clue.round}"`
                )
            }
            if (clue.knowledgeCategory !== pack.knowledgeCategory) {
                errors.push(
                    `[${pack.categoryName} / ${clue.answer}] knowledgeCategory mismatch: pack="${pack.knowledgeCategory}" vs clue="${clue.knowledgeCategory}"`
                )
            }

            const report = verifyProvenanceReceipt({
                clue: {
                    categoryName: clue.categoryName,
                    question: clue.question,
                    answer: clue.answer,
                    value: clue.value,
                    round: clue.round,
                },
                receipt: clue.provenance,
                runMerkleRoot: manifest.merkleRoot,
            })
            if (!report.verified) {
                errors.push(
                    `[${clue.categoryName} / ${clue.answer}] ${report.errors.join(', ')}`
                )
            } else {
                verifiedClues++
            }
        }
    }

    // Recompute the full ordered Merkle root across all clues in the manifest so removed/reordered clues fail
    if (orderedLeafHashes.length > 0) {
        const { root: recomputedRoot } = buildMerkleTree(orderedLeafHashes)
        if (recomputedRoot !== manifest.merkleRoot) {
            errors.push(
                `Manifest merkleRoot mismatch: recomputed=${recomputedRoot.slice(0, 12)} vs declared=${manifest.merkleRoot.slice(0, 12)}`
            )
        }
    } else {
        errors.push('Manifest contains zero clues')
    }

    if (manifest.stats.totalPublished !== totalClues) {
        errors.push(
            `Manifest stats.totalPublished (${manifest.stats.totalPublished}) does not match actual clue count (${totalClues})`
        )
    }

    return {
        valid: errors.length === 0 && verifiedClues === totalClues && totalClues > 0,
        verifiedClues,
        errors,
    }
}

/**
 * Replace any today/future DailyChallenge rows that still point to non-ORIGINAL_ENGINE
 * questions and have zero user completions or unclaimed guest sessions with unused
 * published ORIGINAL_ENGINE FINAL clues.
 * Preserves all historical rows and any row that already has user participation.
 */
export async function rotateUnplayedLegacyDailyChallenges(prisma: PrismaClient): Promise<number> {
    // Use the shared active challenge date (9AM ET boundary) so today's challenge is prioritized first
    const activeDate = getActiveChallengeDate()

    const legacyUpcoming = await prisma.dailyChallenge.findMany({
        where: {
            date: { gte: activeDate },
            question: {
                OR: [
                    { source: { not: 'ORIGINAL_ENGINE' } },
                    { publishStatus: { not: 'PUBLISHED' } },
                ],
            },
            completions: { none: {} },
        },
        orderBy: { date: 'asc' },
        select: { id: true, date: true },
    })

    if (legacyUpcoming.length === 0) return 0

    const usedIds = new Set(
        (await prisma.dailyChallenge.findMany({ select: { questionId: true } })).map((r) => r.questionId)
    )
    const eligibleFinals = await prisma.question.findMany({
        where: {
            source: 'ORIGINAL_ENGINE',
            publishStatus: 'PUBLISHED',
            round: 'FINAL',
            id: { notIn: Array.from(usedIds) },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, airDate: true, episodeId: true },
    })

    let rotated = 0
    for (let i = 0; i < legacyUpcoming.length && i < eligibleFinals.length; i++) {
        const target = legacyUpcoming[i]
        const replacement = eligibleFinals[i]
        const didRotate = await prisma.$transaction(async (tx) => {
            const pendingGuest = await tx.$queryRaw<Array<{ cnt: bigint }>>`
                SELECT COUNT(*)::bigint as cnt
                FROM "GuestSession"
                WHERE "type" = 'DAILY_CHALLENGE'
                  AND "claimedAt" IS NULL
                  AND "expiresAt" > NOW()
                  AND "data"->>'challengeId' = ${target.id}
            `
            if (Number(pendingGuest[0]?.cnt || 0) > 0) {
                return false
            }
            const updatedRows = await tx.$executeRaw`
                UPDATE "DailyChallenge" dc
                SET "questionId" = ${replacement.id},
                    "airDate" = ${replacement.airDate ?? target.date},
                    "episodeGameId" = ${replacement.episodeId}
                WHERE dc."id" = ${target.id}
                  AND NOT EXISTS (
                      SELECT 1 FROM "UserDailyChallenge" udc WHERE udc."challengeId" = dc."id"
                  )
            `
            return Number(updatedRows) > 0
        })
        if (didRotate) rotated++
    }
    return rotated
}

/**
 * Persist a verified GenerationRunManifest into PostgreSQL transactionally.
 * Idempotent on receiptHash (skips already-published clues cleanly).
 */
export async function publishRunManifestToDatabase(
    prisma: PrismaClient,
    manifest: GenerationRunManifest
): Promise<{
    runId: string
    categoriesUpserted: number
    questionsCreated: number
    questionsSkipped: number
    legacyDailyChallengesRotated: number
}> {
    const verification = verifyRunManifest(manifest)
    if (!verification.valid) {
        throw new Error(
            `Refusing to publish unverified manifest: ${verification.errors.slice(0, 5).join('; ')}`
        )
    }

    const packDate = new Date(`${manifest.packReleaseDate}T00:00:00.000Z`)
    const episodeTag = `orig:${manifest.runId.slice(0, 8)}`
    let categoriesUpserted = 0
    let questionsCreated = 0
    let questionsSkipped = 0

    await prisma.$transaction(async (tx) => {
        const existingRun = await tx.questionGenerationRun.findUnique({
            where: { id: manifest.runId },
            select: { merkleRoot: true },
        })
        if (existingRun && existingRun.merkleRoot !== manifest.merkleRoot) {
            throw new Error(
                `Refusing to publish conflicting manifest for existing runId ${manifest.runId}: stored merkleRoot=${existingRun.merkleRoot.slice(0, 12)} !== incoming=${manifest.merkleRoot.slice(0, 12)}`
            )
        }

        await tx.questionGenerationRun.upsert({
            where: { id: manifest.runId },
            update: {
                publishedAt: new Date(),
                totalPassed: manifest.stats.totalPublished,
                screeningCorpusCount: manifest.screeningCorpusCount,
                screeningCorpusHash: manifest.screeningCorpusHash,
            },
            create: {
                id: manifest.runId,
                engineVersion: manifest.engineVersion,
                modelId: manifest.modelId,
                promptTemplateHash: manifest.promptTemplateHash,
                merkleRoot: manifest.merkleRoot,
                screeningCorpusCount: manifest.screeningCorpusCount,
                screeningCorpusHash: manifest.screeningCorpusHash,
                packReleaseDate: packDate,
                totalGenerated: manifest.stats.totalDrafted,
                totalPassed: manifest.stats.totalPublished,
                totalRejectedOverlap: manifest.stats.totalRejectedOverlap,
                manifestJson: manifest as unknown as Prisma.InputJsonValue,
                publishedAt: new Date(),
            },
        })

        for (const pack of manifest.categories) {
            const category = await tx.category.upsert({
                where: {
                    name_source: {
                        name: pack.categoryName,
                        source: 'ORIGINAL_ENGINE',
                    },
                },
                update: {
                    knowledgeCategory: pack.knowledgeCategory,
                },
                create: {
                    name: pack.categoryName,
                    source: 'ORIGINAL_ENGINE',
                    knowledgeCategory: pack.knowledgeCategory,
                },
            })
            categoriesUpserted++

            for (const clue of pack.clues) {
                const existingProv = await tx.questionProvenance.findUnique({
                    where: { receiptHash: clue.provenance.receiptHash },
                    select: { id: true },
                })
                if (existingProv) {
                    questionsSkipped++
                    continue
                }

                const createdQuestion = await tx.question.create({
                    data: {
                        question: clue.question,
                        answer: clue.answer,
                        acceptableAnswers: clue.acceptableAnswers,
                        value: clue.value,
                        difficulty: clue.difficulty,
                        categoryId: category.id,
                        knowledgeCategory: clue.knowledgeCategory,
                        source: 'ORIGINAL_ENGINE',
                        publishStatus: 'PUBLISHED',
                        generationRunId: manifest.runId,
                        airDate: packDate,
                        season: null,
                        episodeId: episodeTag,
                        // Reserve wasTripleStumper for observed historical contestant misses;
                        // Hard Challenge / Triple Stumper practice queries difficulty='HARD' for ORIGINAL_ENGINE.
                        wasTripleStumper: false,
                        isDoubleJeopardy: clue.round === 'DOUBLE',
                        round: clue.round,
                    },
                })

                await tx.questionProvenance.create({
                    data: {
                        questionId: createdQuestion.id,
                        runId: manifest.runId,
                        licenseSpdx: clue.provenance.licenseSpdx,
                        sourceBundle: clue.provenance.sourceBundle as unknown as Prisma.InputJsonValue,
                        sourceBundleHash: clue.provenance.sourceBundleHash,
                        promptTemplateHash: clue.provenance.promptTemplateHash,
                        modelId: clue.provenance.modelId,
                        samplingParams: clue.provenance.samplingParams as unknown as Prisma.InputJsonValue,
                        generatedAt: clue.provenance.generatedAt,
                        outputHash: clue.provenance.outputHash,
                        receiptHash: clue.provenance.receiptHash,
                        merkleLeafHash: clue.provenance.merkleLeafHash,
                        merkleProof: clue.provenance.merkleProof as unknown as Prisma.InputJsonValue,
                        overlapMaxScore: clue.provenance.overlapMaxScore,
                        overlapPassed: clue.provenance.overlapPassed,
                        blindSolverPassed: clue.provenance.blindSolverPassed,
                        qualityScore: clue.provenance.qualityScore,
                        verifiedAt: new Date(clue.provenance.generatedAt),
                    },
                })
                questionsCreated++
            }
        }
    })

    const legacyDailyChallengesRotated = await rotateUnplayedLegacyDailyChallenges(prisma)

    return {
        runId: manifest.runId,
        categoriesUpserted,
        questionsCreated,
        questionsSkipped,
        legacyDailyChallengesRotated,
    }
}

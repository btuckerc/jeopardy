/**
 * CLI: Clean-Room Editorial Pack Sealer
 *
 * Takes an air-gapped CC0/PD writers'-room draft JSON grounded in a live CC0/PD
 * harvest cache, validates EVERY clue against all deterministic quality, anti-leak,
 * wordplay, source-grounding, anti-copy, and real answer-checker gates, optionally
 * runs the real Blind Solver pass (recording true pass/fail & score — never faking
 * blindSolverPassed=true), requires a non-empty reference corpus for the separate
 * blind PASS/REJECT overlap quarantine gate, builds SHA-256 provenance receipts and
 * a binary Merkle root manifest, and verifies the sealed output cryptographically.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json src/scripts/seal-original-pack.ts \
 *     --draft <draft.json> \
 *     --harvest-cache <cc0-cache.json> \
 *     --screen-corpus data/big_questions.json \
 *     --out data/original-packs/starter-pack-v1.json \
 *     [--blind-solver-base-url http://127.0.0.1:18737/v1 --blind-solver-model auto]
 */

import fs from 'fs'
import path from 'path'
import type { Difficulty, JeopardyRound, KnowledgeCategory } from '@prisma/client'
import { runBlindSolverPass } from '../lib/question-engine/generator'
import { discoverActiveLocalModel, resolveLlmConfig } from '../lib/question-engine/llm-client'
import { buildProvenanceReceipt, sha256Hex } from '../lib/question-engine/provenance'
import { finalizeGenerationRun, verifyRunManifest } from '../lib/question-engine/publisher'
import { validateCategoryDiversity, validateDraftClue } from '../lib/question-engine/validators'
import type { ReferenceCorpusEntry } from '../lib/question-engine/overlap-gate'
import {
    ENGINE_VERSION,
    type CategoryArchetype,
    type DraftClue,
    type GeneratedCategoryPack,
    type SourceFactRecord,
    type VerifiedClue,
    type WordplayRule,
} from '../lib/question-engine/types'

export const EDITORIAL_SEAL_TEMPLATE_HASH = sha256Hex(
    `${ENGINE_VERSION}::CLEAN_ROOM_EDITORIAL_SEAL_V1::CC0_PD_GROUNDED::DOUBLE_QUOTES_HOUSE_STYLE::BLIND_OVERLAP_REQUIRED`
)

interface EditorialDraftCategory {
    categoryName: string
    knowledgeCategory: KnowledgeCategory
    round: JeopardyRound
    archetype?: CategoryArchetype
    wordplayRule?: WordplayRule
    clues: Array<{
        value: number
        difficulty: Difficulty
        question: string
        answer: string
        acceptableAnswers?: string[]
        supportingEntityIds: string[]
    }>
}

interface EditorialDraftBundle {
    modelId: string
    releaseDate?: string
    categories: EditorialDraftCategory[]
}

function getArg(argv: string[], flag: string): string | undefined {
    const idx = argv.indexOf(flag)
    return idx >= 0 ? argv[idx + 1] : undefined
}

function loadRequiredReferenceCorpus(filePath?: string): ReferenceCorpusEntry[] {
    if (!filePath) {
        throw new Error('Missing required --screen-corpus <file>: blind overlap screening requires a non-empty reference corpus')
    }
    if (!fs.existsSync(filePath)) {
        throw new Error(`Reference corpus file not found: ${filePath}`)
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (!Array.isArray(parsed)) {
        throw new Error(`Malformed reference corpus (${filePath}): expected JSON array`)
    }
    const entries = parsed
        .filter((r) => r && typeof r === 'object' && r.question && r.answer && r.category)
        .map((r) => ({
            question: String(r.question),
            answer: String(r.answer),
            category: String(r.category),
        }))
    if (entries.length === 0) {
        throw new Error(`Reference corpus (${filePath}) contains zero valid question/answer/category entries`)
    }
    return entries
}

async function main() {
    const argv = process.argv.slice(2)
    const draftPath = getArg(argv, '--draft')
    const cachePath = getArg(argv, '--harvest-cache')
    const outPath = getArg(argv, '--out')
    const screenCorpusPath = getArg(argv, '--screen-corpus')
    const solverBaseUrl = getArg(argv, '--blind-solver-base-url')
    const solverModel = getArg(argv, '--blind-solver-model')

    if (!draftPath || !cachePath || !outPath || !screenCorpusPath) {
        throw new Error(
            'Usage: seal-original-pack.ts --draft <file> --harvest-cache <file> --screen-corpus <file> --out <file> [--blind-solver-base-url URL --blind-solver-model MODEL]'
        )
    }

    // Fail closed immediately on missing/empty/malformed screening corpus
    const referenceCorpus = loadRequiredReferenceCorpus(screenCorpusPath)

    const draftBundle = JSON.parse(fs.readFileSync(draftPath, 'utf8')) as EditorialDraftBundle
    const rawCache = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as Record<string, SourceFactRecord[]>

    // Index all live-harvested CC0/PD records by entityId
    const recordById = new Map<string, SourceFactRecord>()
    for (const recs of Object.values(rawCache)) {
        for (const r of recs) {
            if (!recordById.has(r.entityId)) {
                recordById.set(r.entityId, r)
            }
        }
    }

    const solverConfig = solverBaseUrl
        ? resolveLlmConfig({
              baseUrl: solverBaseUrl,
              model: solverModel || 'auto',
              enableThinking: false,
          })
        : null

    if (solverConfig && solverConfig.model === 'auto') {
        const discovered = await discoverActiveLocalModel(solverConfig.baseUrl)
        if (discovered) {
            solverConfig.model = discovered
        }
    }

    const generatedAt = new Date().toISOString()
    const packs: GeneratedCategoryPack[] = []
    const seenCategoryNames = new Set<string>()
    let totalDrafted = 0
    let totalPassed = 0
    let totalPassedBlindSolver = 0
    const failures: string[] = []

    for (const cat of draftBundle.categories) {
        const catKey = cat.categoryName.trim().toLowerCase()
        if (seenCategoryNames.has(catKey)) {
            failures.push(`[${cat.categoryName}] duplicate categoryName across rounds/categories in the same pack`)
            continue
        }
        seenCategoryNames.add(catKey)

        const expectedCount = cat.round === 'FINAL' ? 1 : 5
        if (cat.clues.length !== expectedCount) {
            failures.push(`[${cat.categoryName}] expected ${expectedCount} clues, got ${cat.clues.length}`)
            continue
        }

        const draftsForCategory: Array<{
            clue: EditorialDraftCategory['clues'][number]
            draft: DraftClue
            citedRecords: SourceFactRecord[]
        }> = []
        let catOk = true

        for (let idx = 0; idx < cat.clues.length; idx++) {
            totalDrafted++
            const c = cat.clues[idx]
            const citedRecords = c.supportingEntityIds
                .map((id) => recordById.get(id))
                .filter((r): r is SourceFactRecord => Boolean(r))

            if (citedRecords.length === 0) {
                failures.push(`[${cat.categoryName} / ${c.answer}] missing live CC0/PD entityId(s): ${c.supportingEntityIds.join(', ')}`)
                catOk = false
                continue
            }

            const draft: DraftClue = {
                categoryName: cat.categoryName,
                question: c.question,
                answer: c.answer,
                acceptableAnswers: c.acceptableAnswers || [],
                suggestedDifficulty: c.difficulty,
                suggestedSlot: idx + 1,
                supportingEntityIds: c.supportingEntityIds,
                supportingFactSummary: citedRecords.map((r) => `${r.sourceSystem}:${r.entityId}`).join(', '),
            }

            const det = validateDraftClue({
                draft,
                sourceRecords: citedRecords,
                round: cat.round,
                wordplayRule: cat.wordplayRule,
            })
            if (!det.passed) {
                failures.push(`[${cat.categoryName} / ${c.answer}] validator failed: ${det.errors.join('; ')}`)
                catOk = false
                continue
            }

            totalPassed++
            draftsForCategory.push({ clue: c, draft, citedRecords })
        }

        if (catOk && cat.round !== 'FINAL') {
            const div = validateCategoryDiversity(draftsForCategory.map((d) => ({ question: d.clue.question })))
            if (!div.passed) {
                failures.push(`[${cat.categoryName}] diversity gate failed: ${div.reason}`)
                catOk = false
            }
        }

        if (!catOk) continue

        // Optionally run the real blind solver and record exact observed results (never fake a pass!)
        const blindMap = solverConfig
            ? await runBlindSolverPass(
                  solverConfig,
                  cat.categoryName,
                  draftsForCategory.map((d) => d.draft)
              )
            : null

        const verifiedClues: VerifiedClue[] = draftsForCategory.map(({ clue: c, citedRecords }, idx) => {
            const solverRes = blindMap?.get(idx)
            const blindSolverPassed = Boolean(solverRes && solverRes.matchedIntended && !solverRes.ambiguityFlag)
            if (blindSolverPassed) totalPassedBlindSolver++
            const qualityScore = solverRes ? solverRes.craftScore : null

            const provenance = buildProvenanceReceipt({
                engineVersion: ENGINE_VERSION,
                sourceBundle: citedRecords,
                promptTemplateHash: EDITORIAL_SEAL_TEMPLATE_HASH,
                modelId: draftBundle.modelId,
                samplingParams: {
                    mode: 'clean-room-editorial-seal',
                    blindSolverModel: solverConfig ? solverConfig.model : null,
                    blindSolverPassed,
                    blindSolverCraftScore: qualityScore,
                },
                generatedAt,
                clue: {
                    categoryName: cat.categoryName,
                    question: c.question,
                    answer: c.answer,
                    value: c.value,
                    round: cat.round,
                },
                overlapMaxScore: null,
                overlapPassed: false,
                blindSolverPassed,
                qualityScore,
            })

            return {
                categoryName: cat.categoryName,
                knowledgeCategory: cat.knowledgeCategory,
                round: cat.round,
                value: c.value,
                difficulty: c.difficulty,
                question: c.question,
                answer: c.answer,
                acceptableAnswers: (c.acceptableAnswers || []).filter(
                    (a) => a && a.toLowerCase() !== c.answer.toLowerCase()
                ),
                archetype: cat.archetype || (cat.round === 'FINAL' ? 'FINAL_TWO_STEP' : 'CLASSIC_THEMATIC'),
                wordplayRule: cat.wordplayRule,
                provenance,
            }
        })

        packs.push({
            categoryName: cat.categoryName,
            knowledgeCategory: cat.knowledgeCategory,
            round: cat.round,
            archetype: cat.archetype || (cat.round === 'FINAL' ? 'FINAL_TWO_STEP' : 'CLASSIC_THEMATIC'),
            wordplayRule: cat.wordplayRule,
            clues: verifiedClues,
        })
    }

    if (failures.length > 0) {
        console.error('Deterministic validation errors:')
        for (const f of failures) console.error('  ✗', f)
        process.exit(1)
    }

    const { manifest, rejectedCategories, rejectedCluesCount } = finalizeGenerationRun({
        packs,
        modelId: draftBundle.modelId,
        promptTemplateHash: EDITORIAL_SEAL_TEMPLATE_HASH,
        packReleaseDate: draftBundle.releaseDate || new Date().toISOString().slice(0, 10),
        referenceCorpus,
        draftStats: {
            totalDrafted,
            totalPassedDeterministic: totalPassed,
            totalPassedBlindSolver,
        },
    })

    const verify = verifyRunManifest(manifest)
    if (!verify.valid) {
        throw new Error(`Manifest cryptographic verification failed: ${verify.errors.join('; ')}`)
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf8')

    console.log(`✓ Sealed Clean-Room Pack: ${outPath}`)
    console.log(`  Run ID:           ${manifest.runId}`)
    console.log(`  Merkle Root:      ${manifest.merkleRoot}`)
    console.log(`  Screening Corpus: ${manifest.screeningCorpusCount} entries (${manifest.screeningCorpusHash.slice(0, 12)}...)`)
    console.log(`  Blind Solver:     ${totalPassedBlindSolver}/${manifest.stats.totalPublished} passed (${solverConfig ? solverConfig.model : 'skipped — recorded false'})`)
    console.log(`  Published Clues:  ${manifest.stats.totalPublished} (${verify.verifiedClues} verified)`)
    console.log(`  Overlap Rejected: ${rejectedCluesCount} clues across ${rejectedCategories.length} categories`)
    console.log(`  By Round:         ${JSON.stringify(manifest.stats.byRound)}`)
    console.log(`  By Domain:        ${JSON.stringify(manifest.stats.byKnowledgeCategory)}`)
}

main().catch((err) => {
    console.error('[Seal] Fatal error:', err)
    process.exit(1)
})

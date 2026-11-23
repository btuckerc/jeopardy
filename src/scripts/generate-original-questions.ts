/**
 * CLI: Clean-Room Original Question Pack Generator
 *
 * Harvests live CC0 1.0 / Public Domain structured facts (Wikidata, Met Open Access,
 * MusicBrainz Core, Project Gutenberg), runs the air-gapped 7-to-5 Writers'-Room
 * generator + blind solver, screens outputs through the separate blind PASS/REJECT
 * overlap gate, builds a Merkle-verified run manifest, and exports to
 * data/original-packs/<date>-<runId>.json (and optionally publishes to PostgreSQL).
 *
 * Usage:
 *   npx ts-node --project tsconfig.json src/scripts/generate-original-questions.ts \
 *     --out data/original-packs/pack-v1.json \
 *     --packs 2 \
 *     --finals 18 \
 *     --screen-corpus data/big_questions.json
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { PrismaClient, type KnowledgeCategory } from '@prisma/client'
import {
    HARVEST_RECIPES,
    buildWordplayBundle,
    createFactBundle,
    executeHarvestRecipe,
} from '../lib/question-engine/harvesters'
import { generateCategoryFromBundle } from '../lib/question-engine/generator'
import { resolveLlmConfig } from '../lib/question-engine/llm-client'
import {
    finalizeGenerationRun,
    publishRunManifestToDatabase,
    verifyRunManifest,
} from '../lib/question-engine/publisher'
import type { ReferenceCorpusEntry } from '../lib/question-engine/overlap-gate'
import type {
    GeneratedCategoryPack,
    SourceFactRecord,
    WordplayRule,
} from '../lib/question-engine/types'

interface CliArgs {
    outPath: string
    releaseDate: string
    categoriesPerRound: number
    finalCount: number
    concurrency: number
    screenCorpusPath?: string
    harvestCachePath?: string
    publish: boolean
    baseUrl?: string
    model?: string
    enableThinking: boolean
}

function parseArgs(argv: string[]): CliArgs {
    const get = (flag: string): string | undefined => {
        const idx = argv.indexOf(flag)
        return idx >= 0 ? argv[idx + 1] : undefined
    }
    const today = new Date().toISOString().slice(0, 10)
    return {
        outPath: get('--out') || path.join(process.cwd(), 'data/original-packs', `pack-${today}.json`),
        releaseDate: get('--date') || today,
        categoriesPerRound: parseInt(get('--categories-per-round') || '6', 10),
        finalCount: parseInt(get('--finals') || '12', 10),
        concurrency: Math.max(1, Math.min(6, parseInt(get('--concurrency') || '3', 10))),
        screenCorpusPath: get('--screen-corpus'),
        harvestCachePath: get('--harvest-cache'),
        publish: argv.includes('--publish'),
        baseUrl: get('--base-url'),
        model: get('--model'),
        enableThinking: argv.includes('--thinking'),
    }
}

function shuffle<T>(arr: T[]): T[] {
    const copy = arr.slice()
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

function loadReferenceCorpus(filePath?: string): ReferenceCorpusEntry[] {
    if (!filePath) {
        throw new Error('Missing required --screen-corpus <file>: blind overlap screening requires a non-empty reference corpus')
    }
    if (!fs.existsSync(filePath)) {
        throw new Error(`Reference corpus file not found: ${filePath}`)
    }
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (!Array.isArray(raw)) {
        throw new Error(`Malformed reference corpus (${filePath}): expected JSON array`)
    }
    const entries = raw
        .filter((r) => r && typeof r === 'object' && r.question && r.answer && r.category)
        .map((r) => ({
            question: String(r.question),
            answer: String(r.answer),
            category: String(r.category),
        }))
    if (entries.length === 0) {
        throw new Error(`Reference corpus (${filePath}) contains zero valid entries`)
    }
    return entries
}

async function main() {
    const args = parseArgs(process.argv.slice(2))
    const llmConfig = resolveLlmConfig({
        baseUrl: args.baseUrl,
        model: args.model,
        enableThinking: args.enableThinking,
    })

    console.log(`[Engine] Model=${llmConfig.model} Endpoint=${llmConfig.baseUrl} Thinking=${llmConfig.enableThinking}`)
    console.log(`[Engine] Step 1: Harvesting CC0 / Public Domain fact records across ${HARVEST_RECIPES.length} recipes...`)

    const harvestedByRecipe = new Map<string, SourceFactRecord[]>()
    const allHarvestedByDomain = new Map<KnowledgeCategory, SourceFactRecord[]>()

    if (args.harvestCachePath && fs.existsSync(args.harvestCachePath)) {
        const cached = JSON.parse(fs.readFileSync(args.harvestCachePath, 'utf8')) as Record<
            string,
            SourceFactRecord[]
        >
        for (const recipe of HARVEST_RECIPES) {
            const recs = cached[recipe.id] || []
            if (recs.length > 0) {
                harvestedByRecipe.set(recipe.id, recs)
                const list = allHarvestedByDomain.get(recipe.knowledgeCategory) || []
                list.push(...recs)
                allHarvestedByDomain.set(recipe.knowledgeCategory, list)
            }
        }
        console.log(`[Engine] Loaded CC0/PD harvest cache from ${args.harvestCachePath}`)
    } else {
        for (const recipe of HARVEST_RECIPES) {
            try {
                const records = await executeHarvestRecipe(recipe)
                harvestedByRecipe.set(recipe.id, records)
                const list = allHarvestedByDomain.get(recipe.knowledgeCategory) || []
                list.push(...records)
                allHarvestedByDomain.set(recipe.knowledgeCategory, list)
                console.log(`  ✓ ${recipe.id} (${recipe.sourceSystem}): ${records.length} CC0/PD records`)
            } catch (err) {
                console.warn(`  ⚠ ${recipe.id} failed: ${err instanceof Error ? err.message : String(err)}`)
            }
        }
        if (args.harvestCachePath) {
            fs.mkdirSync(path.dirname(args.harvestCachePath), { recursive: true })
            fs.writeFileSync(
                args.harvestCachePath,
                JSON.stringify(Object.fromEntries(harvestedByRecipe.entries()), null, 2),
                'utf8'
            )
            console.log(`[Engine] Saved CC0/PD harvest cache to ${args.harvestCachePath}`)
        }
    }

    const totalHarvested = Array.from(harvestedByRecipe.values()).reduce((s, r) => s + r.length, 0)
    if (totalHarvested < 30) {
        throw new Error(`Too few CC0/PD records harvested (${totalHarvested}); aborting.`)
    }
    console.log(`[Engine] Harvested ${totalHarvested} total CC0/PD structured records.`)

    // Track used entityIds AND normalized answers globally ONLY once accepted into a verified pack
    const usedEntities = new Set<string>()
    const usedAnswers = new Set<string>()
    const pickFreshRecords = (
        records: SourceFactRecord[],
        count: number,
        inFlightEntities: Set<string>
    ): SourceFactRecord[] => {
        const fresh = shuffle(
            records.filter(
                (r) =>
                    !usedEntities.has(r.entityId) &&
                    !inFlightEntities.has(r.entityId) &&
                    !usedAnswers.has(r.label.toLowerCase().trim())
            )
        )
        const picked = fresh.slice(0, count)
        picked.forEach((r) => inFlightEntities.add(r.entityId))
        return picked
    }

    const generatedPacks: GeneratedCategoryPack[] = []
    let totalDrafted = 0
    let totalPassedDeterministic = 0
    let totalPassedBlindSolver = 0

    const knowledgeDomains: KnowledgeCategory[] = [
        'GEOGRAPHY_AND_HISTORY',
        'SCIENCE_AND_NATURE',
        'ARTS_AND_LITERATURE',
        'ENTERTAINMENT',
        'SPORTS_AND_LEISURE',
        'GENERAL_KNOWLEDGE',
    ]

    // Step 2: Generate balanced SINGLE and DOUBLE categories across ALL 6 KnowledgeCategory domains
    const targetPerDomain = Math.max(1, Math.ceil(args.categoriesPerRound / knowledgeDomains.length))
    for (const round of ['SINGLE', 'DOUBLE'] as const) {
        console.log(`\n[Engine] Step 2 (${round}): Generating ${args.categoriesPerRound} balanced categories (cap ${targetPerDomain}/domain)...`)
        let createdInRound = 0
        const countByDomain = new Map<KnowledgeCategory, number>()
        let domainIdx = 0

        // Include 1 code-verified wordplay category per round
        const wordplayCandidates: Array<{ rule: WordplayRule; domain: KnowledgeCategory; hint: string }> = [
            {
                rule: { type: 'DOUBLE_LETTER', value: '', description: 'Every answer contains a double letter (like "tt", "ss", "ll", "rr")' },
                domain: 'GENERAL_KNOWLEDGE',
                hint: 'Seeing Double: Famous Places, Elements & Names with Double Letters',
            },
            {
                rule: { type: 'ENDS_WITH', value: 'a', description: 'Every answer ends with the letter "A"' },
                domain: 'GEOGRAPHY_AND_HISTORY',
                hint: 'Ending in "A": World Places, Figures & Wonders',
            },
        ]

        const wpSpec = wordplayCandidates[round === 'SINGLE' ? 0 : 1]
        const allPool = Array.from(allHarvestedByDomain.values()).flat()
        const wpBundle = buildWordplayBundle({
            records: shuffle(
                allPool.filter(
                    (r) => !usedEntities.has(r.entityId) && !usedAnswers.has(r.label.toLowerCase().trim())
                )
            ),
            rule: wpSpec.rule,
            knowledgeCategory: wpSpec.domain,
            round,
            themeHint: wpSpec.hint,
        })
        if (wpBundle) {
            try {
                const res = await generateCategoryFromBundle(llmConfig, wpBundle, {
                    avoidCategoryNames: generatedPacks.map((p) => p.categoryName),
                    avoidAnswers: Array.from(usedAnswers),
                })
                totalDrafted += res.stats.drafted
                totalPassedDeterministic += res.stats.passedDeterministic
                totalPassedBlindSolver += res.stats.passedBlindSolver
                if (res.pack) {
                    res.pack.clues.forEach((c) => {
                        usedAnswers.add(c.answer.toLowerCase().trim())
                        c.provenance.sourceBundle.forEach((s) => usedEntities.add(s.entityId))
                    })
                    generatedPacks.push(res.pack)
                    createdInRound++
                    countByDomain.set(wpSpec.domain, (countByDomain.get(wpSpec.domain) || 0) + 1)
                    console.log(`  ✓ [${round} WORDPLAY] ${res.pack.categoryName} (${res.pack.clues.length} clues)`)
                } else {
                    console.log(`  ✗ [${round} WORDPLAY] skipped: ${res.rejectionReasons.slice(0, 3).join(' | ')}`)
                }
            } catch (err) {
                console.warn(`  ⚠ [${round} WORDPLAY] error: ${err instanceof Error ? err.message : String(err)}`)
            }
        }

        let safetyAttempts = 0
        while (createdInRound < args.categoriesPerRound && safetyAttempts < args.categoriesPerRound * 4) {
            // Plan up to `args.concurrency` disjoint single-recipe jobs in parallel (NEVER mix recipes!)
            const batchJobs: Array<{
                domain: KnowledgeCategory
                recipe: (typeof HARVEST_RECIPES)[number]
                bundle: ReturnType<typeof createFactBundle>
            }> = []

            const remainingNeeded = args.categoriesPerRound - createdInRound
            const batchLimit = Math.min(args.concurrency, remainingNeeded)
            const inFlightEntities = new Set<string>()

            while (batchJobs.length < batchLimit && safetyAttempts < args.categoriesPerRound * 4) {
                safetyAttempts++
                let domain: KnowledgeCategory | null = null
                for (let offset = 0; offset < knowledgeDomains.length; offset++) {
                    const candidate = knowledgeDomains[(domainIdx + offset) % knowledgeDomains.length]
                    const plannedInDomain = batchJobs.filter((j) => j.domain === candidate).length
                    if ((countByDomain.get(candidate) || 0) + plannedInDomain < targetPerDomain) {
                        domain = candidate
                        domainIdx = (domainIdx + offset + 1) % knowledgeDomains.length
                        break
                    }
                }
                if (!domain) break

                const domainRecipes = HARVEST_RECIPES.filter(
                    (r) => r.knowledgeCategory === domain && (harvestedByRecipe.get(r.id)?.length || 0) >= 7
                )
                if (domainRecipes.length === 0) {
                    countByDomain.set(domain, targetPerDomain)
                    continue
                }

                // Try recipes in this domain until we find one with >=7 unused records (never mix recipes!)
                let selectedRecipe: (typeof HARVEST_RECIPES)[number] | null = null
                let slice: SourceFactRecord[] = []
                for (let rOff = 0; rOff < domainRecipes.length; rOff++) {
                    const candRecipe = domainRecipes[(safetyAttempts + rOff) % domainRecipes.length]
                    const pool = harvestedByRecipe.get(candRecipe.id) || []
                    const avail = pool.filter(
                        (r) =>
                            !usedEntities.has(r.entityId) &&
                            !inFlightEntities.has(r.entityId) &&
                            !usedAnswers.has(r.label.toLowerCase().trim())
                    )
                    if (avail.length >= 7) {
                        selectedRecipe = candRecipe
                        slice = pickFreshRecords(pool, 14, inFlightEntities)
                        break
                    }
                }
                if (!selectedRecipe || slice.length < 7) {
                    countByDomain.set(domain, targetPerDomain)
                    continue
                }

                batchJobs.push({
                    domain,
                    recipe: selectedRecipe,
                    bundle: createFactBundle({
                        knowledgeCategory: domain,
                        round,
                        archetype: selectedRecipe.archetype,
                        themeHint: selectedRecipe.themeHint,
                        records: slice.slice(0, 14),
                    }),
                })
            }

            if (batchJobs.length === 0) break

            const existingCatNames = generatedPacks.map((p) => p.categoryName)
            const existingAnswers = Array.from(usedAnswers)
            const results = await Promise.all(
                batchJobs.map(async (job) => {
                    try {
                        const res = await generateCategoryFromBundle(llmConfig, job.bundle, {
                            avoidCategoryNames: existingCatNames,
                            avoidAnswers: existingAnswers,
                        })
                        return { job, res, err: null as unknown }
                    } catch (err) {
                        return { job, res: null, err }
                    }
                })
            )

            for (const { job, res, err } of results) {
                if (err || !res) {
                    console.warn(
                        `  ⚠ [${round}] ${job.recipe.id} error: ${err instanceof Error ? err.message : String(err)}`
                    )
                    continue
                }
                totalDrafted += res.stats.drafted
                totalPassedDeterministic += res.stats.passedDeterministic
                totalPassedBlindSolver += res.stats.passedBlindSolver

                if (res.pack && createdInRound < args.categoriesPerRound) {
                    const dupCat = generatedPacks.some(
                        (p) => p.categoryName.toLowerCase() === res.pack!.categoryName.toLowerCase()
                    )
                    if (dupCat) {
                        console.log(`  ✗ [${round}] ${job.recipe.id} duplicate category "${res.pack.categoryName}" skipped`)
                        continue
                    }
                    res.pack.clues.forEach((c) => {
                        usedAnswers.add(c.answer.toLowerCase().trim())
                        c.provenance.sourceBundle.forEach((s) => usedEntities.add(s.entityId))
                    })
                    generatedPacks.push(res.pack)
                    createdInRound++
                    countByDomain.set(job.domain, (countByDomain.get(job.domain) || 0) + 1)
                    console.log(
                        `  ✓ [${round}] ${res.pack.categoryName} (${job.domain}) — ${res.pack.clues.length} clues, avg craft ${(
                            res.pack.clues.reduce((s, c) => s + (c.provenance.qualityScore || 0), 0) /
                            res.pack.clues.length
                        ).toFixed(2)}`
                    )
                } else if (!res.pack) {
                    console.log(`  ✗ [${round}] ${job.recipe.id} rejected: ${res.rejectionReasons.slice(0, 3).join(' | ')}`)
                }
            }
        }
    }

    // Step 3: Generate FINAL ROUND two-step deduction clues from SINGLE coherent recipes (in parallel batches!)
    console.log(`\n[Engine] Step 3 (FINAL): Generating ${args.finalCount} two-step Final clues...`)
    let finalsCreated = 0
    let finalAttempts = 0
    while (finalsCreated < args.finalCount && finalAttempts < args.finalCount * 3) {
        const finalBatch: Array<{
            domain: KnowledgeCategory
            recipe: (typeof HARVEST_RECIPES)[number]
            bundle: ReturnType<typeof createFactBundle>
        }> = []
        const batchLimit = Math.min(args.concurrency, args.finalCount - finalsCreated)

        while (finalBatch.length < batchLimit && finalAttempts < args.finalCount * 3) {
            finalAttempts++
            const domain = knowledgeDomains[finalAttempts % knowledgeDomains.length]
            const domainRecipes = HARVEST_RECIPES.filter(
                (r) => r.knowledgeCategory === domain && (harvestedByRecipe.get(r.id)?.length || 0) >= 5
            )
            if (domainRecipes.length === 0) continue

            const recipe = domainRecipes[finalAttempts % domainRecipes.length]
            const recipeRecords = (harvestedByRecipe.get(recipe.id) || []).filter(
                (r) => !usedAnswers.has(r.label.toLowerCase().trim())
            )
            if (recipeRecords.length < 3) continue

            // Prefer top-notability (earlier in sitelink-sorted list) records for household-worthy Final answers!
            const topHalf = recipeRecords.slice(0, Math.max(6, Math.ceil(recipeRecords.length * 0.6)))
            const slice = shuffle(topHalf).slice(0, 6)
            finalBatch.push({
                domain,
                recipe,
                bundle: createFactBundle({
                    knowledgeCategory: domain,
                    round: 'FINAL',
                    archetype: 'FINAL_TWO_STEP',
                    themeHint: recipe.themeHint,
                    records: slice,
                }),
            })
        }

        if (finalBatch.length === 0) break

        const existingCatNames = generatedPacks.map((p) => p.categoryName)
        const existingAnswers = Array.from(usedAnswers)
        const results = await Promise.all(
            finalBatch.map(async (job) => {
                try {
                    const res = await generateCategoryFromBundle(llmConfig, job.bundle, {
                        avoidCategoryNames: existingCatNames,
                        avoidAnswers: existingAnswers,
                    })
                    return { job, res, err: null as unknown }
                } catch (err) {
                    return { job, res: null, err }
                }
            })
        )

        for (const { job, res, err } of results) {
            if (err || !res) {
                console.warn(`  ⚠ [FINAL] ${job.recipe.id} error: ${err instanceof Error ? err.message : String(err)}`)
                continue
            }
            totalDrafted += res.stats.drafted
            totalPassedDeterministic += res.stats.passedDeterministic
            totalPassedBlindSolver += res.stats.passedBlindSolver

            if (res.pack && finalsCreated < args.finalCount) {
                const ansKey = res.pack.clues[0].answer.toLowerCase().trim()
                if (usedAnswers.has(ansKey)) continue
                usedAnswers.add(ansKey)
                generatedPacks.push(res.pack)
                finalsCreated++
                console.log(
                    `  ✓ [FINAL #${finalsCreated}] ${res.pack.categoryName} -> ${res.pack.clues[0].answer}`
                )
            }
        }
    }

    // Step 4: Separate Blind PASS/REJECT Overlap Quarantine Gate + Merkle Root Finalization
    console.log(`\n[Engine] Step 4: Running Blind Overlap Quarantine Gate & Merkle Finalization...`)
    const referenceCorpus = loadReferenceCorpus(args.screenCorpusPath)
    if (referenceCorpus.length > 0) {
        console.log(`  Indexed ${referenceCorpus.length} reference corpus entries (blind PASS/REJECT mode — zero text feedback)`)
    }

    const { manifest, rejectedCategories, rejectedCluesCount } = finalizeGenerationRun({
        packs: generatedPacks,
        modelId: llmConfig.model,
        packReleaseDate: args.releaseDate,
        referenceCorpus,
        draftStats: {
            totalDrafted,
            totalPassedDeterministic,
            totalPassedBlindSolver,
        },
    })

    const verify = verifyRunManifest(manifest)
    if (!verify.valid) {
        throw new Error(`Manifest self-verification failed: ${verify.errors.join('; ')}`)
    }

    fs.mkdirSync(path.dirname(args.outPath), { recursive: true })
    fs.writeFileSync(args.outPath, JSON.stringify(manifest, null, 2), 'utf8')

    console.log(`\n[Engine] DONE!`)
    console.log(`  Manifest:           ${args.outPath}`)
    console.log(`  Run ID:             ${manifest.runId}`)
    console.log(`  Merkle Root:        ${manifest.merkleRoot}`)
    console.log(`  Published Clues:    ${manifest.stats.totalPublished} (${verify.verifiedClues} cryptographically verified)`)
    console.log(`  Overlap Rejected:   ${rejectedCluesCount} clues across ${rejectedCategories.length} categories`)
    console.log(`  By Round:           ${JSON.stringify(manifest.stats.byRound)}`)
    console.log(`  By Domain:          ${JSON.stringify(manifest.stats.byKnowledgeCategory)}`)

    if (args.publish) {
        const prisma = new PrismaClient()
        try {
            const pubRes = await publishRunManifestToDatabase(prisma, manifest)
            console.log(`  DB Publish Result:  ${JSON.stringify(pubRes)}`)
        } finally {
            await prisma.$disconnect()
        }
    }
}

main().catch((err) => {
    console.error('[Engine] Fatal error:', err)
    process.exit(1)
})

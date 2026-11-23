/**
 * Air-Gapped Clean-Room Writers'-Room Trivia Generator
 *
 * ARCHITECTURAL GUARANTEE:
 * - ZERO imports of jarchive-scraper, overlap-gate, data/*.json, or LEGACY_JEOPARDY queries.
 * - Accepts ONLY a CC0/PD FactBundle and produces authentic quiz-show categories,
 *   7-to-5 drafted clue ladders, two-step Final clues, blind-solver verification,
 *   and cryptographic provenance receipts.
 */

import type { Difficulty, JeopardyRound } from '@prisma/client'
import { checkAnswerDetailed } from '../../app/lib/answer-checker'
import { callLlmJson, type LlmConfig } from './llm-client'
import { buildProvenanceReceipt, sha256Hex } from './provenance'
import { validateCategoryDiversity, validateDraftClue } from './validators'
import {
    ENGINE_VERSION,
    type BlindSolverResult,
    type DraftClue,
    type FactBundle,
    type GeneratedCategoryPack,
    type SourceFactRecord,
    type VerifiedClue,
} from './types'

export const WRITER_SYSTEM_PROMPT = `You are a veteran head writer for a prestige televised general-knowledge quiz show.
Your sole goal is broadcast clues that score 8.8-9.5/10 in blind editorial review—taut, witty, authoritative, rock-solid factually, and genuinely rewarding to solve:
1. CRYSTAL-CLEAR CATEGORY TITLE (NEVER VAGUE OR MASHUP):
   - The ALL-CAPS category title (2-4 words) MUST unambiguously signal the exact domain or answer type (e.g., "WORLD CAPITALS", "U.S. PRESIDENTS", "CHEMICAL ELEMENTS", "CLASSIC NOVELS", "FAMOUS PAINTINGS", "WORLD LANDMARKS", "MYTHOLOGY", "SCIENTIFIC UNITS", "BEST PICTURE WINNERS", "U.S. STATES", "CLASSICAL COMPOSERS", "ICONIC STADIUMS", "WORLD RIVERS & PEAKS", or explicit wordplay like "DOUBLE-LETTER ANSWERS").
   - NEVER use vague poetic titles ("SEAT OF POWER", "STONES OF GENIUS", "THE GOLDEN SHELF", "NAMED AND NUMBERED") or awkward A-&-B mashup titles.
2. SURGICAL FACTUAL PRECISION:
   - Every date, name, attribution, geography claim, and etymology MUST be 100% historically accurate and grounded in the CC0/Public Domain fact bundle.
   - NEVER approximate ("six years" for 5.5 years), NEVER overstate etymologies ("novelty" when Greek neos means "new"), NEVER claim "every X" when exceptions exist, NEVER conflate who isolated an element vs who named it or who discovered moons vs who named them, and NEVER conflate a movie with its sequel.
   - If you are not 100% certain of a detail beyond the CC0 bundle, OMIT IT.
3. TAUT, WITTY BROADCAST HOUSE STYLE (12-19 WORDS, ZERO STACKED GIVEAWAYS):
   - Follow authentic televised quiz-show house style: use DOUBLE quotes ("Profiles in Courage", "Old Hickory") rather than single quotes, omit the trailing period on single-sentence clues, and write crisp, conversational spoken lines with a touch of wit or wordplay—NEVER encyclopedia blurbs or bio cards.
   - CRITICAL ANTI-OVERSTACKING RULE: Never stack 2-3 independent giveaways in one clue (e.g., never give BOTH "liquid metal" AND "Roman messenger god" for mercury, or BOTH "Bram Stoker" AND "Transylvanian count" for Dracula, or BOTH "Perseus" AND "nearest spiral galaxy" for Andromeda). Give ONE vivid route at $200/$400 and withhold the obvious giveaway at $600-$2000 so contestants earn a genuine "aha!"
   - NEVER write résumé dash-ranges ("this 1961–1963 Democrat"), NEVER tack on bio statistics ("won 25 Grammys"), NEVER use chatty second-person tags, and NEVER leak a root word ("Parisii" for Paris, "Odawa" for Ottawa).
   - ALWAYS include a crisp demonstrative or pronoun pointer ("this", "these", "he", "she", "his", "her", "whose") pointing directly to the exact canonical answer.
   - Use digits for numbers (82,500). No "?", no atomic-number giveaways, no ISO codes, no Wikidata/Wikipedia/Jeopardy! mentions.
4. TRUE DIFFICULTY LADDER & WORDPLAY CLARITY (7-TO-5 RULE):
   - Calibrate ruthlessly: $200/$400 = warm, punchy 11-16 word household clue; $600/$800/$1200 = familiar subject approached sideways by withholding its trademark hook; $1000/$1600/$2000 = genuine deduction with zero early giveaways!
   - Wordplay category titles MUST state the rule unmistakably (e.g., "DOUBLE-LETTER ANSWERS", "ENDS WITH \"A\""), never an ambiguous pun.
5. CRISP ANSWERS & ALIASES: Natural concise spoken answer (1-5 words, no "What is") plus 0-3 genuinely equivalent acceptableAnswers aliases.
Respond strictly with valid JSON.`

export const FINAL_WRITER_SYSTEM_PROMPT = `You are crafting a signature FINAL ROUND quiz-show clue—the dramatic, unforgettable climax of the broadcast.
Craft standards for 9.0+/10 Final Round clues:
1. ONE HOUSEHOLD-ICONIC ENTITY, TRUE TWO-STEP LATERAL DEDUCTION (WITHHOLD THE OBVIOUS HOOK!):
   - Pick ONE genuinely famous entity from the CC0/Public Domain bundle, WITHHOLD its cliché trademark identifier (e.g., never say "white marble" or "Mumtaz" for Taj Mahal; never say "Wiltshire ring" or "solstices" for Stonehenge; never say "Set" and "Isis" together for Osiris), and instead bridge TWO non-obvious threads so contestants take a real 2-step mental leap during the 30-second think music!
   - NEVER write a one-step recall giveaway or stack 3 independent hints.
2. CRISP DOMAIN CATEGORY TITLE:
   - Use a clean, classic 2-3 word Final Round domain title (e.g., "WORLD LANDMARKS", "CLASSIC LITERATURE", "FINE ART", "WORLD GEOGRAPHY", "SCIENCE HISTORY", "MYTHOLOGY", "CLASSICAL MUSIC", "ASTRONOMY", "AMERICAN HISTORY", "WORLD CINEMA")—never vague poetry.
3. 100% FACTUAL PRECISION: Every date, attribution, geography claim, and etymology must be strictly accurate and verified. Never assert disputed etymologies or unverified transport theories.
4. BROADCAST VOICE: ONE complete, dramatic declarative sentence (16-24 words), double quotes, no trailing period, with a clear demonstrative pointer ("this...", "he...", "she..."). No sentence fragments, no '?', no purple prose, no trademarked show names.
Respond strictly with valid JSON.`

export const BLIND_SOLVER_SYSTEM_PROMPT = `You are an expert quiz-show contestant testing draft clues BLIND.
You receive ONLY the category title and clue text (you do NOT see the intended answer or facts).
For each clue:
1. Give your single best concise answer (no "What is").
2. List any OTHER genuinely plausible answers that ALSO strictly fit the clue wording (empty array if uniquely pinned).
3. Rate your confidence (0.0 to 1.0) where 0.95 = very accessible top-row clue and 0.45 = tough bottom-row clue.
4. Rate the clue's broadcast craft/voice on a 1.0 to 10.0 scale (penalize over-stuffed giveaways, dry database phrasing, vague category titles, chatty tags, or purple prose).
Respond strictly with valid JSON.`

export const SHOWRUNNER_EDITOR_SYSTEM_PROMPT = `You are a ruthless, Emmy-winning quiz-show head editor performing the final broadcast gate before taping.
You receive candidate clues, their intended answers, AND the raw CC0/Public Domain source records.
Reject or ruthlessly polish EVERY flaw:
1. FACTUAL PRECISION: Verify EVERY single date, count, geography claim, attribution (discoverer vs namer: e.g., Lavoisier named oxygen/hydrogen, Davy named chlorine, Sefström named vanadium, Simon Marius named Jupiter's moons — NEVER credit a discoverer with someone else's name; never confuse a film with its sequel or a tournament host with the final venue), and etymology. If ANY detail is loose, exaggerated ("every lightbulb", "six years" for 5.5, "novelty" instead of "new"), or inaccurate -> factualOk = false OR rewrite strictly to rock-solid verified facts!
2. EXACT GRAMMAR POINTER & CATEGORY CLARITY: Verify "this/these/he/she" points to the EXACT canonical answer (NEVER write "this Italian master..." when the answer is a painting title!). Ensure polishedCategoryName is a crisp, standard 2-4 word domain title (e.g., "WORLD CAPITALS", "CLASSIC NOVELS", "CHEMICAL ELEMENTS", "WORLD LANDMARKS", "CLASSICAL MUSIC", "GREEK MYTHOLOGY", "ASTRONOMY", "FINE ART")—replace any vague/poetic title!
3. BROADCAST ECONOMY & VARIED OPENINGS: Cut over-stuffed giveaways (4 hints where 2 suffice), cut tacked-on birth/death years, cut obscure venue filler, cut chatty second-person tags ("you've ever bought"), cut purple prose, and fix any sentence fragment or bare "it". Vary sentence openings across the 5 clues—NEVER start 4 or 5 clues with "This ...".
4. CALIBRATION & FINAL RIGOR: For FINAL round clues, reject any one-step giveaway (like "Gopher State" for Minnesota or "sport born in Scotland" for golf) OR obscure specialist answer—require a household-famous answer solved via genuine two-step lateral deduction.
5. STRICT SCORING: Only give broadcastScore >= 8.0 to clues that genuinely rival or beat prime-time televised quiz writing. Mark keep = false for anything clunky, obscure, ambiguous, or dull.
Respond strictly with valid JSON.`

export const PROMPT_TEMPLATE_HASH = sha256Hex(
    `${ENGINE_VERSION}::${WRITER_SYSTEM_PROMPT}::${FINAL_WRITER_SYSTEM_PROMPT}::${BLIND_SOLVER_SYSTEM_PROMPT}::${SHOWRUNNER_EDITOR_SYSTEM_PROMPT}`
)

const SINGLE_VALUES = [200, 400, 600, 800, 1000] as const
const DOUBLE_VALUES = [400, 800, 1200, 1600, 2000] as const

function difficultyForSlot(slotIndex: number, round: JeopardyRound): Difficulty {
    if (round === 'FINAL') return 'HARD'
    if (slotIndex <= 1) return 'EASY'
    if (slotIndex <= 3) return 'MEDIUM'
    return 'HARD'
}

function valueForSlot(slotIndex: number, round: JeopardyRound): number {
    if (round === 'FINAL') return 2000
    const ladder = round === 'DOUBLE' ? DOUBLE_VALUES : SINGLE_VALUES
    return ladder[Math.min(Math.max(slotIndex, 0), 4)]
}

function formatFactRecordsForPrompt(records: SourceFactRecord[]): string {
    return JSON.stringify(
        records.map((r) => ({
            entityId: r.entityId,
            label: r.label,
            source: r.sourceSystem,
            facts: r.facts,
        })),
        null,
        2
    )
}

interface RawDraftBatch {
    categoryName: string
    clues: Array<{
        question: string
        answer: string
        acceptableAnswers?: string[]
        suggestedDifficulty?: 'EASY' | 'MEDIUM' | 'HARD'
        suggestedSlot?: number
        supportingEntityIds: string[]
        supportingFactSummary?: string
    }>
}

interface RawBlindSolveBatch {
    results: Array<{
        index: number
        guessedAnswer: string
        alternatePlausibleAnswers?: string[]
        confidence: number
        craftScore: number
        reasoning?: string
    }>
}

/**
 * Draft 7 candidate clues for a Single/Double category (or 3 Final candidates)
 * strictly from the provided CC0/PD FactBundle.
 */
async function draftCluesFromBundle(
    llmConfig: LlmConfig,
    bundle: FactBundle,
    options?: { avoidCategoryNames?: string[]; avoidAnswers?: string[] }
): Promise<{
    categoryName: string
    drafts: DraftClue[]
    modelId: string
    samplingParams: Record<string, unknown>
}> {
    const isFinal = bundle.round === 'FINAL'
    const targetCount = isFinal ? 3 : 7

    const wordplayInstructions = bundle.wordplayRule
        ? `\nMANDATORY WORDPLAY RULE: Every single answer MUST satisfy "${bundle.wordplayRule.description}". Your category title MUST clearly signal this rule to the player!`
        : ''
    const avoidCatNote =
        options?.avoidCategoryNames && options.avoidCategoryNames.length > 0
            ? `\nDO NOT reuse any of these existing category titles: ${options.avoidCategoryNames.slice(-15).join(', ')}. Invent a fresh, witty ALL-CAPS title.`
            : ''
    const avoidAnsNote =
        options?.avoidAnswers && options.avoidAnswers.length > 0
            ? `\nDO NOT use any of these already-used answers: ${options.avoidAnswers.slice(-30).join(', ')}.`
            : ''

    const userPrompt = isFinal
        ? `Create ${targetCount} distinct FINAL ROUND two-step deduction clue candidates using ONLY the CC0/Public Domain facts below.
Knowledge domain: ${bundle.knowledgeCategory}
Theme inspiration: ${bundle.themeHint}${avoidCatNote}${avoidAnsNote}

Return JSON of shape:
{
  "categoryName": "ALL CAPS CATEGORY TITLE",
  "clues": [
    {
      "question": "Declarative two-step Final clue (18-32 words, no '?')",
      "answer": "Canonical Answer",
      "acceptableAnswers": ["optional valid alias"],
      "suggestedDifficulty": "HARD",
      "suggestedSlot": 1,
      "supportingEntityIds": ["Q..."],
      "supportingFactSummary": "Brief note of which bundle facts were combined"
    }
  ]
}

CC0/PD SOURCE FACT BUNDLE:
${formatFactRecordsForPrompt(bundle.records)}`
        : `Draft ${targetCount} distinct quiz-show clues for ONE cohesive ${bundle.round} round category using ONLY the CC0/Public Domain facts below.
Knowledge domain: ${bundle.knowledgeCategory}
Archetype: ${bundle.archetype}
Theme inspiration: ${bundle.themeHint}${wordplayInstructions}${avoidCatNote}${avoidAnsNote}

Spread the ${targetCount} clues from accessible top-row ($200/$400) to challenging bottom-row ($1000/$2000). Each clue MUST use a DIFFERENT entity/answer from the bundle.
Return JSON of shape:
{
  "categoryName": "PUNCHY ALL-CAPS TITLE",
  "clues": [
    {
      "question": "Crisp declarative clue (12-24 words, no '?')",
      "answer": "Canonical Answer",
      "acceptableAnswers": ["optional alias"],
      "suggestedDifficulty": "EASY | MEDIUM | HARD",
      "suggestedSlot": 1,
      "supportingEntityIds": ["Q..."],
      "supportingFactSummary": "Brief list of bundle facts used"
    }
  ]
}

CC0/PD SOURCE FACT BUNDLE:
${formatFactRecordsForPrompt(bundle.records)}`

    const resp = await callLlmJson<RawDraftBatch>(llmConfig, {
        systemPrompt: isFinal ? FINAL_WRITER_SYSTEM_PROMPT : WRITER_SYSTEM_PROMPT,
        userPrompt,
        temperature: 0.6,
        maxTokens: isFinal ? 1800 : 2800,
    })

    const categoryName = (resp.data.categoryName || bundle.themeHint)
        .toUpperCase()
        .replace(/[^A-Z0-9\s"&'\-!?]/g, '')
        .trim()
        .slice(0, 60)

    const drafts: DraftClue[] = (resp.data.clues || []).map((c, idx) => ({
        categoryName,
        question: String(c.question || '').trim(),
        answer: String(c.answer || '').trim(),
        acceptableAnswers: Array.isArray(c.acceptableAnswers)
            ? c.acceptableAnswers.map((a) => String(a).trim()).filter(Boolean)
            : [],
        suggestedDifficulty:
            c.suggestedDifficulty === 'EASY' ||
            c.suggestedDifficulty === 'MEDIUM' ||
            c.suggestedDifficulty === 'HARD'
                ? c.suggestedDifficulty
                : difficultyForSlot(idx, bundle.round),
        suggestedSlot: typeof c.suggestedSlot === 'number' ? c.suggestedSlot : idx + 1,
        supportingEntityIds: Array.isArray(c.supportingEntityIds)
            ? c.supportingEntityIds.map(String)
            : [],
        supportingFactSummary: String(c.supportingFactSummary || '').trim(),
    }))

    return {
        categoryName,
        drafts,
        modelId: resp.model,
        samplingParams: resp.samplingParams,
    }
}

/**
 * Blind-solver pass: tests clues with ZERO access to intended answer or source bundle.
 */
export async function runBlindSolverPass(
    llmConfig: LlmConfig,
    categoryName: string,
    drafts: DraftClue[]
): Promise<Map<number, BlindSolverResult & { craftScore: number }>> {
    if (drafts.length === 0) return new Map()

    const promptClues = drafts.map((d, index) => ({
        index,
        categoryName,
        clue: d.question,
    }))

    const resp = await callLlmJson<RawBlindSolveBatch>(llmConfig, {
        systemPrompt: BLIND_SOLVER_SYSTEM_PROMPT,
        userPrompt: `Solve and critique each of these draft clues BLIND.
Return JSON:
{
  "results": [
    {
      "index": 0,
      "guessedAnswer": "Your concise answer",
      "alternatePlausibleAnswers": [],
      "confidence": 0.85,
      "craftScore": 8.4,
      "reasoning": "One short sentence"
    }
  ]
}

CLUES:
${JSON.stringify(promptClues, null, 2)}`,
        temperature: 0.15,
        maxTokens: 2048,
    })

    const map = new Map<number, BlindSolverResult & { craftScore: number }>()
    for (const item of resp.data.results || []) {
        const draft = drafts[item.index]
        if (!draft) continue

        const guessed = String(item.guessedAnswer || '').trim()
        const alts = Array.isArray(item.alternatePlausibleAnswers)
            ? item.alternatePlausibleAnswers.map((a) => String(a).trim()).filter(Boolean)
            : []

        // Check whether blind solver matched canonical answer or an approved alias using Trivrdy's real grader
        const allValid = [draft.answer, ...draft.acceptableAnswers]
        const matchedIntended = allValid.some((valid) => checkAnswerDetailed(guessed, valid).accepted)

        // Filter out alternates that are actually equivalent to the intended answer
        const genuineCompetingAlts = alts.filter(
            (alt) => !allValid.some((valid) => checkAnswerDetailed(alt, valid).accepted)
        )

        map.set(item.index, {
            guessedAnswer: guessed,
            alternatePlausibleAnswers: genuineCompetingAlts,
            confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0.5)),
            matchedIntended,
            ambiguityFlag: genuineCompetingAlts.length > 0,
            reasoning: String(item.reasoning || ''),
            craftScore: Math.min(10, Math.max(1, Number(item.craftScore) || 6.5)),
        })
    }

    return map
}

interface RawShowrunnerBatch {
    polishedCategoryName?: string
    reviews: Array<{
        index: number
        keep: boolean
        factualOk: boolean
        polishedQuestion?: string
        additionalAliases?: string[]
        difficultyRank: number // 1..5
        broadcastScore: number // 1..10
        notes?: string
    }>
}

/**
 * Showrunner Fact-Check & Voice-Polish Pass:
 * Verifies every factual claim, date, etymology, superlative, and grammar pointer
 * against the CC0/PD source records, rejects flawed clues, and polishes passing clues
 * for broadcast-ready quiz-show voice.
 */
async function runShowrunnerEditorPass(
    llmConfig: LlmConfig,
    categoryName: string,
    round: JeopardyRound,
    candidates: Array<{ draft: DraftClue; citedRecords: SourceFactRecord[] }>
): Promise<RawShowrunnerBatch> {
    const payload = candidates.map((c, index) => ({
        index,
        question: c.draft.question,
        answer: c.draft.answer,
        acceptableAnswers: c.draft.acceptableAnswers,
        sources: c.citedRecords.map((r) => ({
            entityId: r.entityId,
            label: r.label,
            aliases: r.aliases || [],
            facts: r.facts,
        })),
    }))

    const resp = await callLlmJson<RawShowrunnerBatch>(llmConfig, {
        systemPrompt: SHOWRUNNER_EDITOR_SYSTEM_PROMPT,
        userPrompt: `Audit and polish these ${round} round clues for category "${categoryName}".
Only keep clues that are 100% factually accurate, cleanly pinned, and broadcast-worthy (>= 8.0).
If you polish wording, keep every fact strictly inside the provided CC0/PD sources and preserve the exact answer without leaking it!
Return JSON:
{
  "polishedCategoryName": "OPTIONAL TIGHTER ALL-CAPS TITLE",
  "reviews": [
    {
      "index": 0,
      "keep": true,
      "factualOk": true,
      "polishedQuestion": "Crisp, witty broadcast-ready declarative clue (12-24 words)",
      "additionalAliases": ["optional alias"],
      "difficultyRank": 2,
      "broadcastScore": 8.6,
      "notes": "Brief verification note"
    }
  ]
}

CANDIDATES:
${JSON.stringify(payload, null, 2)}`,
        temperature: 0.25,
        maxTokens: 3200,
    })

    return resp.data
}

export interface GenerateCategoryResult {
    pack: GeneratedCategoryPack | null
    stats: {
        drafted: number
        passedDeterministic: number
        passedBlindSolver: number
    }
    rejectionReasons: string[]
}

/**
 * Generate one complete verified category pack (5 clues for Single/Double, or 1 Final clue)
 * from a clean-room CC0/PD FactBundle.
 */
export async function generateCategoryFromBundle(
    llmConfig: LlmConfig,
    bundle: FactBundle,
    options?: {
        avoidCategoryNames?: string[]
        avoidAnswers?: string[]
        showrunnerConfig?: LlmConfig
    }
): Promise<GenerateCategoryResult> {
    const rejectionReasons: string[] = []
    const requiredCount = bundle.round === 'FINAL' ? 1 : 5

    // Step 1: 7-to-5 Drafting strictly from CC0/PD FactBundle
    const { categoryName: rawCategoryName, drafts, modelId, samplingParams } = await draftCluesFromBundle(
        llmConfig,
        bundle,
        options
    )

    // Ensure categoryName is unique BEFORE sealing cryptographic provenance receipts
    let categoryName = rawCategoryName
    const avoidCatLower = new Set((options?.avoidCategoryNames || []).map((n) => n.toLowerCase()))
    if (avoidCatLower.has(categoryName.toLowerCase())) {
        const suffix = bundle.round === 'FINAL' ? 'SHOWDOWN' : bundle.round === 'DOUBLE' ? 'II' : 'EDITION'
        categoryName = `${categoryName} ${suffix}`.slice(0, 60)
        let n = 2
        while (avoidCatLower.has(categoryName.toLowerCase())) {
            categoryName = `${rawCategoryName.slice(0, 54)} #${n++}`
        }
        drafts.forEach((d) => {
            d.categoryName = categoryName
        })
    }

    const avoidAnsLower = new Set((options?.avoidAnswers || []).map((a) => a.toLowerCase().trim()))

    // Step 2: Deterministic quality, anti-leak, wordplay, and answer-checker gates
    const seenAnswers = new Set<string>()
    const validDrafts: DraftClue[] = []
    for (const draft of drafts) {
        const answerKey = draft.answer.toLowerCase().trim()
        if (seenAnswers.has(answerKey) || avoidAnsLower.has(answerKey)) {
            rejectionReasons.push(`Duplicate answer "${draft.answer}" in category ${categoryName}`)
            continue
        }
        const det = validateDraftClue({
            draft,
            sourceRecords: bundle.records,
            round: bundle.round,
            wordplayRule: bundle.wordplayRule,
        })
        if (!det.passed) {
            rejectionReasons.push(`[${draft.answer}] ${det.errors.join('; ')}`)
            continue
        }
        seenAnswers.add(answerKey)
        validDrafts.push(draft)
    }

    if (validDrafts.length < requiredCount) {
        return {
            pack: null,
            stats: {
                drafted: drafts.length,
                passedDeterministic: validDrafts.length,
                passedBlindSolver: 0,
            },
            rejectionReasons,
        }
    }

    // Step 3: Showrunner Fact-Check & Voice-Polish Pass (verifies every fact & polishes TV voice!)
    const recordById = new Map(bundle.records.map((r) => [r.entityId, r]))
    const draftWithRecords = validDrafts.map((draft) => {
        const citedRecords = draft.supportingEntityIds
            .map((id) => recordById.get(id))
            .filter((r): r is SourceFactRecord => Boolean(r))
        return {
            draft,
            citedRecords: citedRecords.length > 0 ? citedRecords : bundle.records.slice(0, 1),
        }
    })

    const editorResult = await runShowrunnerEditorPass(
        options?.showrunnerConfig || llmConfig,
        categoryName,
        bundle.round,
        draftWithRecords
    )

    // Apply polished category title if unique and non-empty
    if (editorResult.polishedCategoryName) {
        const cleaned = editorResult.polishedCategoryName
            .toUpperCase()
            .replace(/[^A-Z0-9\s"&'\-!?]/g, '')
            .trim()
            .slice(0, 60)
        if (cleaned.length >= 3 && !avoidCatLower.has(cleaned.toLowerCase()) && !/\bJEOPARDY\b/i.test(cleaned)) {
            categoryName = cleaned
        }
    }

    const editedDrafts: Array<{
        draft: DraftClue
        citedRecords: SourceFactRecord[]
        difficultyRank: number
        broadcastScore: number
    }> = []

    const reviewByIdx = new Map((editorResult.reviews || []).map((r) => [r.index, r]))
    for (let i = 0; i < draftWithRecords.length; i++) {
        const { draft, citedRecords } = draftWithRecords[i]
        const rev = reviewByIdx.get(i)
        if (!rev || !rev.keep || !rev.factualOk) {
            rejectionReasons.push(`[${draft.answer}] Showrunner rejected: ${rev?.notes || 'factual/craft gate'}`)
            continue
        }
        const score = Math.min(10, Math.max(1, Number(rev.broadcastScore) || 0))
        if (score < 8.0) {
            rejectionReasons.push(`[${draft.answer}] Showrunner score too low (${score})`)
            continue
        }

        const polishedQuestion = (rev.polishedQuestion || draft.question).trim()
        const mergedAliases = Array.from(
            new Set([
                ...draft.acceptableAnswers,
                ...(Array.isArray(rev.additionalAliases) ? rev.additionalAliases : []),
                ...citedRecords.flatMap((r) => r.aliases || []).slice(0, 2),
            ])
        ).filter((a) => a && a.toLowerCase() !== draft.answer.toLowerCase())

        const updatedDraft: DraftClue = {
            ...draft,
            categoryName,
            question: polishedQuestion,
            acceptableAnswers: mergedAliases,
        }

        // Re-validate polished clue deterministically (zero leaks, zero hallucinated years, wordplay intact!)
        const postDet = validateDraftClue({
            draft: updatedDraft,
            sourceRecords: bundle.records,
            round: bundle.round,
            wordplayRule: bundle.wordplayRule,
        })
        if (!postDet.passed) {
            rejectionReasons.push(`[${draft.answer}] Post-polish validator failed: ${postDet.errors.join('; ')}`)
            continue
        }

        editedDrafts.push({
            draft: updatedDraft,
            citedRecords,
            difficultyRank: Math.min(5, Math.max(1, Number(rev.difficultyRank) || 3)),
            broadcastScore: score,
        })
    }

    if (editedDrafts.length < requiredCount) {
        return {
            pack: null,
            stats: {
                drafted: drafts.length,
                passedDeterministic: validDrafts.length,
                passedBlindSolver: 0,
            },
            rejectionReasons,
        }
    }

    // Step 4: Blind Solver & Pinning Verification on the polished broadcast clues
    const blindResults = await runBlindSolverPass(
        llmConfig,
        categoryName,
        editedDrafts.map((e) => e.draft)
    )

    const scoredCandidates: Array<{
        draft: DraftClue
        blind: BlindSolverResult & { craftScore: number }
        citedRecords: SourceFactRecord[]
        difficultyRank: number
        combinedScore: number
    }> = []

    let passedBlindSolverCount = 0

    for (let i = 0; i < editedDrafts.length; i++) {
        const item = editedDrafts[i]
        const blind = blindResults.get(i)
        if (!blind) {
            rejectionReasons.push(`[${item.draft.answer}] Missing blind solver response`)
            continue
        }
        if (!blind.matchedIntended) {
            rejectionReasons.push(
                `[${item.draft.answer}] Blind solver missed (guessed "${blind.guessedAnswer}")`
            )
            continue
        }
        if (blind.ambiguityFlag) {
            rejectionReasons.push(
                `[${item.draft.answer}] Ambiguous pinning (competing answers: ${blind.alternatePlausibleAnswers.join(', ')})`
            )
            continue
        }
        const combinedScore = Number(((item.broadcastScore * 0.6 + blind.craftScore * 0.4)).toFixed(2))
        if (combinedScore < 7.9) {
            rejectionReasons.push(`[${item.draft.answer}] Combined craft score too low (${combinedScore})`)
            continue
        }

        passedBlindSolverCount++
        scoredCandidates.push({
            draft: item.draft,
            blind,
            citedRecords: item.citedRecords,
            difficultyRank: item.difficultyRank,
            combinedScore,
        })
    }

    if (scoredCandidates.length < requiredCount) {
        return {
            pack: null,
            stats: {
                drafted: drafts.length,
                passedDeterministic: validDrafts.length,
                passedBlindSolver: passedBlindSolverCount,
            },
            rejectionReasons,
        }
    }

    // Step 5: Select top 5 (or top 1 for Final) by combinedScore, then order strictly along the difficulty ladder
    const selected = scoredCandidates
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, requiredCount)
        .sort((a, b) => {
            const scoreA = a.difficultyRank - a.blind.confidence * 0.9
            const scoreB = b.difficultyRank - b.blind.confidence * 0.9
            return scoreA - scoreB
        })

    // Step 4b: Category-level template & diversity check (prevents robotic repetitive clues)
    if (bundle.round !== 'FINAL') {
        const div = validateCategoryDiversity(selected.map((s) => ({ question: s.draft.question })))
        if (!div.passed) {
            rejectionReasons.push(`Category rejected for template repetition: ${div.reason}`)
            return {
                pack: null,
                stats: {
                    drafted: drafts.length,
                    passedDeterministic: validDrafts.length,
                    passedBlindSolver: passedBlindSolverCount,
                },
                rejectionReasons,
            }
        }
    }

    const generatedAt = new Date().toISOString()

    // Step 5: Assemble VerifiedClues with cryptographic provenance receipts
    const clues: VerifiedClue[] = selected.map((item, slotIdx) => {
        const value = valueForSlot(slotIdx, bundle.round)
        const difficulty = difficultyForSlot(slotIdx, bundle.round)

        // Merge CC0 record aliases + writer aliases, deduplicated
        const aliasSet = new Set<string>()
        for (const a of item.draft.acceptableAnswers) {
            if (a && a.toLowerCase() !== item.draft.answer.toLowerCase()) {
                aliasSet.add(a)
            }
        }

        const provenance = buildProvenanceReceipt({
            engineVersion: ENGINE_VERSION,
            sourceBundle: item.citedRecords,
            promptTemplateHash: PROMPT_TEMPLATE_HASH,
            modelId,
            samplingParams,
            generatedAt,
            clue: {
                categoryName,
                question: item.draft.question,
                answer: item.draft.answer,
                value,
                round: bundle.round,
            },
            overlapMaxScore: null,
            overlapPassed: false, // Must be verified by BlindOverlapGate before publication!
            blindSolverPassed: true,
            qualityScore: item.blind.craftScore,
        })

        return {
            categoryName,
            knowledgeCategory: bundle.knowledgeCategory,
            round: bundle.round,
            value,
            difficulty,
            question: item.draft.question,
            answer: item.draft.answer,
            acceptableAnswers: Array.from(aliasSet),
            archetype: bundle.archetype,
            wordplayRule: bundle.wordplayRule,
            provenance,
        }
    })

    return {
        pack: {
            categoryName,
            knowledgeCategory: bundle.knowledgeCategory,
            round: bundle.round,
            archetype: bundle.archetype,
            wordplayRule: bundle.wordplayRule,
            clues,
        },
        stats: {
            drafted: drafts.length,
            passedDeterministic: validDrafts.length,
            passedBlindSolver: passedBlindSolverCount,
        },
        rejectionReasons,
    }
}

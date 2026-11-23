/**
 * Clean-Room Original Trivia Engine — Shared Types
 *
 * Strictly air-gapped from legacy Jeopardy data. All facts originate exclusively
 * from allowlisted CC0 1.0 Universal or verified Public Domain structured sources.
 */

import type { Difficulty, JeopardyRound, KnowledgeCategory } from '@prisma/client'

export const ENGINE_VERSION = '1.0.0'

export type AllowedLicenseSpdx = 'CC0-1.0' | 'Public-Domain' | 'CC0-1.0 AND Public-Domain'

export type SourceSystem =
    | 'WIKIDATA_CC0'
    | 'MET_OPEN_ACCESS_CC0'
    | 'MUSICBRAINZ_CORE_CC0'
    | 'PROJECT_GUTENBERG_PD'

export type CategoryArchetype =
    | 'CLASSIC_THEMATIC'
    | 'WORDPLAY_LETTER_RULE'
    | 'CROSS_DOMAIN_TWIST'
    | 'LITERARY_PUBLIC_DOMAIN'
    | 'FINE_ART_CURATED'
    | 'MUSIC_HISTORY'
    | 'FINAL_TWO_STEP'

export interface WordplayRule {
    type: 'STARTS_WITH' | 'ENDS_WITH' | 'CONTAINS' | 'DOUBLE_LETTER' | 'EXACT_LENGTH'
    value: string | number
    description: string
}

/**
 * Single verified structured fact record fetched from a CC0/PD source.
 * Contains ONLY structured fields/triples — never scraped third-party trivia or CC BY-SA prose.
 */
export interface SourceFactRecord {
    sourceSystem: SourceSystem
    licenseSpdx: 'CC0-1.0' | 'Public-Domain'
    entityId: string // e.g. 'Q7186', 'met:436535', 'mb:1f9df192-...', 'pg:1342'
    sourceUrl: string
    fetchedAt: string // ISO-8601 timestamp
    label: string // Canonical entity name / answer candidate
    aliases?: string[] // Known CC0 alternate names
    facts: Record<string, string | number | string[]> // Structured key-value properties
}

/**
 * Immutable input bundle handed to the air-gapped clue generator.
 */
export interface FactBundle {
    bundleId: string
    knowledgeCategory: KnowledgeCategory
    round: JeopardyRound
    archetype: CategoryArchetype
    themeHint: string
    wordplayRule?: WordplayRule
    records: SourceFactRecord[]
    harvestedAt: string
}

/**
 * Candidate clue produced by the 7-to-5 Drafting Writer.
 */
export interface DraftClue {
    categoryName: string
    question: string
    answer: string
    acceptableAnswers: string[]
    suggestedDifficulty: Difficulty
    suggestedSlot: number // 1..5 for Single/Double, 1 for Final
    supportingEntityIds: string[] // References SourceFactRecord.entityId
    supportingFactSummary: string
    editorialNote?: string
}

/**
 * Blind-solver verification result (solver never sees intended answer or fact bundle).
 */
export interface BlindSolverResult {
    guessedAnswer: string
    alternatePlausibleAnswers: string[]
    confidence: number // 0..1
    matchedIntended: boolean
    ambiguityFlag: boolean
    reasoning: string
}

/**
 * Deterministic + LLM quality audit result for one clue.
 */
export interface ClueVerificationResult {
    passed: boolean
    deterministicErrors: string[]
    deterministicWarnings: string[]
    blindSolver: BlindSolverResult
    factuallyGrounded: boolean
    craftScore: number // 1..10
    difficultyRank: number // 1 (easiest) .. 5 (hardest)
}

export interface MerkleProofStep {
    position: 'left' | 'right'
    hash: string
}

/**
 * Cryptographic provenance receipt proving clean-room CC0/PD derivation.
 */
export interface ProvenanceReceipt {
    engineVersion: string
    licenseSpdx: AllowedLicenseSpdx
    sourceBundle: SourceFactRecord[]
    sourceBundleHash: string
    promptTemplateHash: string
    modelId: string
    samplingParams: Record<string, unknown>
    generatedAt: string
    outputHash: string
    receiptHash: string
    merkleLeafHash: string
    merkleProof: MerkleProofStep[]
    overlapMaxScore: number | null
    overlapPassed: boolean
    blindSolverPassed: boolean
    qualityScore: number | null
}

/**
 * Verified, publication-ready clue with attached provenance receipt.
 */
export interface VerifiedClue {
    categoryName: string
    knowledgeCategory: KnowledgeCategory
    round: JeopardyRound
    value: number
    difficulty: Difficulty
    question: string
    answer: string
    acceptableAnswers: string[]
    archetype: CategoryArchetype
    wordplayRule?: WordplayRule
    provenance: ProvenanceReceipt
}

export interface GeneratedCategoryPack {
    categoryName: string
    knowledgeCategory: KnowledgeCategory
    round: JeopardyRound
    archetype: CategoryArchetype
    wordplayRule?: WordplayRule
    clues: VerifiedClue[]
}

export interface GenerationRunManifest {
    runId: string
    engineVersion: string
    modelId: string
    promptTemplateHash: string
    packReleaseDate: string // YYYY-MM-DD
    createdAt: string
    merkleRoot: string
    screeningCorpusCount: number
    screeningCorpusHash: string
    stats: {
        totalDrafted: number
        totalPassedDeterministic: number
        totalPassedBlindSolver: number
        totalRejectedOverlap: number
        totalPublished: number
        byKnowledgeCategory: Record<string, number>
        byRound: Record<string, number>
    }
    categories: GeneratedCategoryPack[]
}

/**
 * Blind PASS/REJECT overlap result. NEVER includes any reference/legacy clue text.
 */
export interface OverlapCheckResult {
    passed: boolean
    maxClueSimilarity: number
    maxCategorySimilarity: number
    reason: string
}

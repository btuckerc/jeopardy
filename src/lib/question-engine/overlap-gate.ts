/**
 * Clean-Room Blind PASS/REJECT Overlap Quarantine Gate
 *
 * ARCHITECTURAL BOUNDARY:
 * - This module is NEVER imported by generator.ts or harvesters.ts.
 * - It is invoked ONLY post-generation before DRAFT -> PUBLISHED promotion.
 * - It returns strictly { passed, maxClueSimilarity, maxCategorySimilarity, reason }
 *   and NEVER exposes reference/legacy clue text back to any generation prompt or caller.
 * - Candidates that fail are DISCARDED, never rewritten from reference text.
 */

import crypto from 'crypto'
import { normalizeAnswerText } from '../../app/lib/answer-checker'
import type { OverlapCheckResult } from './types'

export interface ReferenceCorpusEntry {
    question: string
    answer: string
    category: string
}

const TOKEN_STOPWORDS = new Set([
    'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'by', 'with',
    'and', 'or', 'is', 'was', 'are', 'were', 'it', 'its', 'this', 'that',
    'from', 'as', 'he', 'she', 'his', 'her', 'they', 'their', 'who', 'which',
    'one', 'two', 'into', 'out', 'up', 'about', 'after', 'before', 'over',
])

function tokenizeContent(text: string): string[] {
    return normalizeAnswerText(text)
        .split(/\s+/)
        .filter((w) => w.length >= 2 && !TOKEN_STOPWORDS.has(w))
}

function buildNgrams(words: string[], n: number): Set<string> {
    const out = new Set<string>()
    for (let i = 0; i <= words.length - n; i++) {
        out.add(words.slice(i, i + n).join(' '))
    }
    return out
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0
    let intersection = 0
    for (const item of a) {
        if (b.has(item)) intersection++
    }
    const union = a.size + b.size - intersection
    return union === 0 ? 0 : intersection / union
}

function maxNgramOverlapRatio(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0
    let shared = 0
    for (const gram of a) {
        if (b.has(gram)) shared++
    }
    return shared / Math.min(a.size, b.size)
}

interface IndexedEntry {
    normAnswer: string
    normCategory: string
    tokens: Set<string>
    trigrams: Set<string>
    fourgrams: Set<string>
    rawFourgrams: Set<string>
}

export class BlindOverlapGate {
    private byAnswer = new Map<string, IndexedEntry[]>()
    private byCategory = new Map<string, IndexedEntry[]>()
    private byRawFourgram = new Map<string, IndexedEntry[]>()
    private totalIndexed = 0
    private readonly digestHash: string

    constructor(entries: ReferenceCorpusEntry[]) {
        const hasher = crypto.createHash('sha256')
        for (const entry of entries) {
            if (!entry || typeof entry.question !== 'string' || typeof entry.answer !== 'string') continue
            const normAnswer = normalizeAnswerText(entry.answer).replace(/^(a|an|the)\s+/, '').trim()
            const normCategory = normalizeAnswerText(entry.category || '').trim()
            const normQuestion = normalizeAnswerText(entry.question).trim()
            const contentWords = tokenizeContent(entry.question)
            const rawWords = normQuestion.split(/\s+/).filter(Boolean)

            // Reject unusable / whitespace-only corpus rows (including blank categories)
            if (!normCategory || !normAnswer || !normQuestion || contentWords.length === 0) continue

            // Hash the full canonical text (category, answer, and normalized clue text)
            hasher.update(`${normCategory}\x1f${normAnswer}\x1f${normQuestion}\n`)

            const indexed: IndexedEntry = {
                normAnswer,
                normCategory,
                tokens: new Set(contentWords),
                trigrams: buildNgrams(contentWords, 3),
                fourgrams: buildNgrams(contentWords, 4),
                rawFourgrams: buildNgrams(rawWords, 4),
            }

            if (normAnswer) {
                const arr = this.byAnswer.get(normAnswer) || []
                arr.push(indexed)
                this.byAnswer.set(normAnswer, arr)
            }

            if (normCategory) {
                const arr = this.byCategory.get(normCategory) || []
                arr.push(indexed)
                this.byCategory.set(normCategory, arr)
            }

            for (const fg of indexed.rawFourgrams) {
                const arr = this.byRawFourgram.get(fg) || []
                if (arr.length < 30) {
                    arr.push(indexed)
                    this.byRawFourgram.set(fg, arr)
                }
            }

            this.totalIndexed++
        }
        this.digestHash = hasher.digest('hex')
    }

    get indexedCount(): number {
        return this.totalIndexed
    }

    get corpusHash(): string {
        return this.digestHash
    }

    /**
     * Screen one candidate clue. Returns ONLY blind pass/fail + scalar scores + reason code.
     * Fails CLOSED when the reference corpus is empty.
     */
    screenClue(candidate: {
        question: string
        answer: string
        categoryName: string
    }): OverlapCheckResult {
        if (this.totalIndexed === 0) {
            return {
                passed: false,
                maxClueSimilarity: 1,
                maxCategorySimilarity: 1,
                reason: 'REJECT_EMPTY_CORPUS',
            }
        }

        const normAnswer = normalizeAnswerText(candidate.answer).replace(/^(a|an|the)\s+/, '').trim()
        const normCategory = normalizeAnswerText(candidate.categoryName)
        const contentWords = tokenizeContent(candidate.question)
        const rawWords = normalizeAnswerText(candidate.question).split(/\s+/).filter(Boolean)
        const candTokens = new Set(contentWords)
        const candTrigrams = buildNgrams(contentWords, 3)
        const candFourgrams = buildNgrams(contentWords, 4)
        const candRawFourgrams = buildNgrams(rawWords, 4)

        // Gather candidate neighbors via answer index + raw 4-gram inverted index
        const neighbors = new Set<IndexedEntry>()
        for (const item of this.byAnswer.get(normAnswer) || []) {
            neighbors.add(item)
        }
        for (const fg of candRawFourgrams) {
            for (const item of this.byRawFourgram.get(fg) || []) {
                neighbors.add(item)
            }
        }

        let maxClueSim = 0
        let hitSameAnswerHighOverlap = false
        let hitVerbatimFourgram = false

        for (const ref of neighbors) {
            const tokenSim = jaccardSimilarity(candTokens, ref.tokens)
            const trigramSim = maxNgramOverlapRatio(candTrigrams, ref.trigrams)
            const fourgramSim = maxNgramOverlapRatio(candFourgrams, ref.fourgrams)
            const rawFourgramSim = maxNgramOverlapRatio(candRawFourgrams, ref.rawFourgrams)

            const combined = Math.max(tokenSim, trigramSim * 0.9, fourgramSim, rawFourgramSim * 0.95)
            if (combined > maxClueSim) {
                maxClueSim = combined
            }

            // Stricter threshold when both clues share the exact same canonical answer
            if (ref.normAnswer === normAnswer && (tokenSim >= 0.48 || trigramSim >= 0.45 || rawFourgramSim >= 0.35)) {
                hitSameAnswerHighOverlap = true
            }

            // Reject near-verbatim phrasing even for different answers
            if (rawFourgramSim >= 0.5 || tokenSim >= 0.65) {
                hitVerbatimFourgram = true
            }
        }

        // Category title match check
        const maxCategorySim = this.byCategory.has(normCategory) ? 1.0 : 0.0

        if (hitSameAnswerHighOverlap) {
            return {
                passed: false,
                maxClueSimilarity: Number(maxClueSim.toFixed(4)),
                maxCategorySimilarity: maxCategorySim,
                reason: 'REJECT_SAME_ANSWER_HIGH_OVERLAP',
            }
        }

        if (hitVerbatimFourgram) {
            return {
                passed: false,
                maxClueSimilarity: Number(maxClueSim.toFixed(4)),
                maxCategorySimilarity: maxCategorySim,
                reason: 'REJECT_NEAR_VERBATIM_PHRASING',
            }
        }

        return {
            passed: true,
            maxClueSimilarity: Number(maxClueSim.toFixed(4)),
            maxCategorySimilarity: maxCategorySim,
            reason: 'PASS',
        }
    }

    /**
     * Screen an entire 5-clue category set to prevent reproducing selection & arrangement
     * (e.g., same category title AND >=2 identical answers from a reference category).
     */
    screenCategorySet(categoryName: string, answers: string[]): OverlapCheckResult {
        if (this.totalIndexed === 0) {
            return {
                passed: false,
                maxClueSimilarity: 1,
                maxCategorySimilarity: 1,
                reason: 'REJECT_EMPTY_CORPUS',
            }
        }
        const normCategory = normalizeAnswerText(categoryName)
        const refEntries = this.byCategory.get(normCategory)
        if (!refEntries || refEntries.length === 0) {
            return {
                passed: true,
                maxClueSimilarity: 0,
                maxCategorySimilarity: 0,
                reason: 'PASS',
            }
        }

        const refAnswerSet = new Set(refEntries.map((r) => r.normAnswer))
        const candAnswers = answers.map((a) => normalizeAnswerText(a).replace(/^(a|an|the)\s+/, '').trim())
        const overlapCount = candAnswers.filter((a) => refAnswerSet.has(a)).length
        const overlapRatio = candAnswers.length > 0 ? overlapCount / candAnswers.length : 0

        if (overlapCount >= 2 || overlapRatio >= 0.4) {
            return {
                passed: false,
                maxClueSimilarity: Number(overlapRatio.toFixed(4)),
                maxCategorySimilarity: 1.0,
                reason: 'REJECT_CATEGORY_SELECTION_OVERLAP',
            }
        }

        return {
            passed: true,
            maxClueSimilarity: Number(overlapRatio.toFixed(4)),
            maxCategorySimilarity: 1.0,
            reason: 'PASS',
        }
    }
}

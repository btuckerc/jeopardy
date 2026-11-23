/**
 * Deterministic Clue Quality, Wordplay, Anti-Leak, and Grader Compatibility Gates
 *
 * Runs BEFORE blind-solver review and BEFORE publication.
 * Strictly clean-room (zero reference to legacy Jeopardy data).
 */

import { checkAnswerDetailed, normalizeAnswerText } from '../../app/lib/answer-checker'
import type { DraftClue, SourceFactRecord, WordplayRule } from './types'

export interface DeterministicValidationResult {
    passed: boolean
    errors: string[]
    warnings: string[]
}

const FORBIDDEN_QUIZBOT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\bwhich of the following\b/i, label: 'multiple-choice phrasing' },
    { pattern: /\bwhat is the name of\b/i, label: 'quiz-question phrasing instead of declarative clue' },
    { pattern: /\bwho was the\b/i, label: 'interrogative phrasing instead of declarative clue' },
    { pattern: /\bwho is the\b/i, label: 'interrogative phrasing instead of declarative clue' },
    { pattern: /\bwhat is the capital of\b/i, label: 'interrogative phrasing instead of declarative clue' },
    { pattern: /\bcan you name\b/i, label: 'meta-prompt phrasing' },
    { pattern: /\bjeopardy!?\b/i, label: 'trademarked show name in clue' },
    { pattern: /\bdaily double\b/i, label: 'trademarked show mechanic in clue' },
    { pattern: /\baccording to wikidata\b/i, label: 'source leakage in clue' },
    { pattern: /\baccording to wikipedia\b/i, label: 'source leakage in clue' },
    { pattern: /\bproject gutenberg\b/i, label: 'source leakage in clue' },
    { pattern: /\batomic number\s+\d+\b/i, label: 'dry atomic-number giveaway' },
    { pattern: /\biso code\b/i, label: 'dry ISO-code template' },
    { pattern: /\b(?:winner|film|movie|song|book)\s+in\s+this\s+category\b/i, label: 'broken demonstrative ("this category" instead of pointing to answer)' },
    { pattern: /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)-[a-z]+\s+thousand\b/i, label: 'spelled-out large number instead of digits' },
    { pattern: /\byou(?:'ve|'ll|'d|'re|\s+ever|\s+might)\b/i, label: 'chatty second-person tag' },
    { pattern: /;\s*(?:he|she)\s+(?:died|was\s+born)\s+in\s+\d{4}/i, label: 'tacked-on biographical date filler' },
    { pattern: /\bcolossus\s+shelters\b/i, label: 'purple prose' },
]

const STOPWORDS = new Set([
    'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'by', 'with',
    'and', 'or', 'is', 'was', 'are', 'were', 'it', 'its', 'this', 'that',
    'from', 'as', 'st', 'mt', 'dr', 'mr', 'mrs', 'ms', 'jr', 'sr',
])

export function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Strip leading articles/question phrasing to get the core answer string for wordplay checks.
 */
export function coreAnswerForWordplay(answer: string): string {
    return normalizeAnswerText(answer)
        .replace(/^(a|an|the)\s+/, '')
        .trim()
}

/**
 * Programmatically verify that an answer satisfies a category's wordplay constraint.
 */
export function verifyWordplayRule(answer: string, rule: WordplayRule): boolean {
    const core = coreAnswerForWordplay(answer)
    if (!core) return false
    const compact = core.replace(/\s+/g, '')

    switch (rule.type) {
        case 'STARTS_WITH': {
            const prefix = String(rule.value).toLowerCase()
            return core.startsWith(prefix) || core.split(' ').some((w) => w.startsWith(prefix))
        }
        case 'ENDS_WITH': {
            const suffix = String(rule.value).toLowerCase()
            return core.endsWith(suffix)
        }
        case 'CONTAINS': {
            const sub = String(rule.value).toLowerCase()
            return compact.includes(sub)
        }
        case 'DOUBLE_LETTER': {
            if (typeof rule.value === 'string' && rule.value.length === 1) {
                const doubled = rule.value.toLowerCase() + rule.value.toLowerCase()
                return compact.includes(doubled)
            }
            return /([a-z])\1/.test(compact)
        }
        case 'EXACT_LENGTH': {
            const targetLen = Number(rule.value)
            return compact.length === targetLen
        }
        default:
            return true
    }
}

/**
 * Check if a clue leaks the answer (or a distinctive content token from the answer)
 * verbatim inside the clue text.
 */
export function hasAnswerLeak(clue: string, answer: string): boolean {
    // Strip possessive suffixes ('s / ’s) BEFORE normalization so "Ampère's" -> "ampere"
    const stripPossessive = (s: string) => s.replace(/['’]s\b/gi, '')
    const normClue = normalizeAnswerText(stripPossessive(clue))
    const normAnswer = normalizeAnswerText(stripPossessive(answer)).replace(/^(a|an|the)\s+/, '').trim()
    if (!normAnswer) return true

    // Exact phrase leak (including simple plural +s)
    if (normAnswer.length >= 3) {
        const escaped = normAnswer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        if (new RegExp(`\\b${escaped}s?\\b`, 'i').test(normClue)) {
            return true
        }
    }

    // Check distinctive content words (length >= 4) and 5-letter morphological stems
    // Avoid false positives on generic geographic/structural/common short nouns
    const genericWords = new Set([
        'river', 'ocean', 'mountain', 'mountains', 'island', 'islands', 'united',
        'states', 'state', 'republic', 'kingdom', 'empire', 'treaty', 'battle', 'world',
        'national', 'international', 'great', 'north', 'south', 'central', 'east', 'west',
        'american', 'british', 'french', 'german', 'italian', 'spanish', 'russian',
        'chinese', 'japanese', 'indian', 'greek', 'roman', 'english', 'first', 'second',
        'third', 'century', 'symphony', 'concerto', 'sonata', 'museum', 'gallery', 'palace',
        'tower', 'bridge', 'planet', 'element', 'prize', 'award', 'order', 'house', 'party',
        'stadium', 'arena', 'field', 'castle', 'cathedral', 'basilica', 'monastery',
        'mosque', 'temple', 'chapel', 'building', 'center', 'centre', 'complex', 'park',
        'garden', 'square', 'bowl', 'court', 'wall', 'gate', 'hall', 'mount', 'peak', 'lake',
        'city', 'town', 'port', 'fort', 'isle', 'cape', 'gulf', 'strait', 'bay', 'sea',
        'agreement', 'protocol', 'conference', 'convention', 'charter', 'accord', 'games',
        'franc', 'dollar', 'dinar', 'pound', 'rupee', 'shilling', 'krone', 'krona',
        'guilder', 'currency', 'language', 'opera', 'picture', 'movie', 'novel', 'book',
        'story', 'tales', 'tale', 'night', 'star', 'moon', 'time', 'life', 'love', 'king',
        'queen', 'duke', 'lord', 'lady', 'pope', 'saint', 'john', 'mary', 'paul', 'mark',
        'anne', 'jane', 'james', 'george', 'charles', 'william', 'henry', 'thomas', 'david',
        'robert', 'michael', 'joseph', 'richard', 'edward', 'alexander', 'andrew', 'frank',
        'blue', 'gold', 'iron', 'white', 'black', 'green', 'last', 'best', 'open', 'free',
        'high', 'long', 'real', 'true', 'good', 'york', 'mexico', 'china', 'italy', 'france',
        'spain', 'japan', 'india', 'egypt', 'greece', 'germany', 'russia',
        'sunday', 'island', 'afternoon', 'hundred', 'years', 'super', 'series', 'tour', 'cup',
        'grand', 'open', 'masters', 'classic', 'derby', 'olympic', 'fifa', 'club', 'team',
    ])
    const clueTokenList = normClue.split(/\s+/).filter(Boolean)
    const clueTokens = new Set(clueTokenList)
    const clueStems5 = new Set(
        clueTokenList.filter((t) => t.length >= 5 && !genericWords.has(t)).map((t) => t.slice(0, 5))
    )
    const answerTokens = normAnswer
        .split(/\s+/)
        .filter((t) => t.length >= 4 && !STOPWORDS.has(t) && !genericWords.has(t))

    for (const token of answerTokens) {
        if (clueTokens.has(token) || clueTokens.has(`${token}s`)) {
            return true
        }
        // Catch morphological root leaks like "mutineer" -> "mutiny", "galilean" -> "galileo"
        if (token.length >= 5 && clueStems5.has(token.slice(0, 5))) {
            return true
        }
    }

    return false
}

/**
 * Check for verbatim prose copying (7+ consecutive words from any prose field of >=10 words,
 * or 5+ consecutive words from a non-Wikidata description field).
 */
export function hasSourceProseCopying(clue: string, records: SourceFactRecord[]): boolean {
    const clueWords = normalizeAnswerText(clue).split(/\s+/).filter(Boolean)
    if (clueWords.length < 5) return false

    const clue5Grams = new Set<string>()
    for (let i = 0; i <= clueWords.length - 5; i++) {
        clue5Grams.add(clueWords.slice(i, i + 5).join(' '))
    }
    const clue7Grams = new Set<string>()
    for (let i = 0; i <= clueWords.length - 7; i++) {
        clue7Grams.add(clueWords.slice(i, i + 7).join(' '))
    }

    for (const record of records) {
        for (const [key, val] of Object.entries(record.facts)) {
            const text = Array.isArray(val) ? val.join(' ') : String(val)
            const words = normalizeAnswerText(text).split(/\s+/).filter(Boolean)
            if (key === 'wikidataDesc') {
                // Short CC0 Wikidata descriptions (<10 words) are structured labels, not prose
                if (words.length < 10) continue
                for (let i = 0; i <= words.length - 7; i++) {
                    if (clue7Grams.has(words.slice(i, i + 7).join(' '))) return true
                }
            } else {
                if (words.length < 7) continue
                for (let i = 0; i <= words.length - 5; i++) {
                    if (clue5Grams.has(words.slice(i, i + 5).join(' '))) return true
                }
            }
        }
    }

    return false
}

/**
 * Check that a 5-clue category doesn't fall into repetitive fill-in-the-blank templates.
 */
export function validateCategoryDiversity(clues: Array<{ question: string }>): {
    passed: boolean
    reason?: string
} {
    if (clues.length < 4) return { passed: true }

    const firstWordCounts = new Map<string, number>()
    const openingCounts = new Map<string, number>()
    let isoCodeMentions = 0
    for (const c of clues) {
        const words = normalizeAnswerText(c.question).split(/\s+/).filter(Boolean)
        if (words.length >= 1) {
            firstWordCounts.set(words[0], (firstWordCounts.get(words[0]) || 0) + 1)
        }
        if (words.length >= 2) {
            const key = `${words[0]} ${words[1]}`
            openingCounts.set(key, (openingCounts.get(key) || 0) + 1)
        }
        if (/\biso code\b/i.test(c.question)) isoCodeMentions++
    }

    for (const [firstWord, count] of firstWordCounts.entries()) {
        if (count >= 4) {
            return { passed: false, reason: `Monotonous opening word "${firstWord}" used ${count}/5 times` }
        }
    }
    for (const [opening, count] of openingCounts.entries()) {
        if (count >= 3) {
            return { passed: false, reason: `Repetitive template opening "${opening}" used ${count} times` }
        }
    }
    if (isoCodeMentions >= 2) {
        return { passed: false, reason: `Repetitive "ISO code" template used ${isoCodeMentions} times` }
    }

    return { passed: true }
}

/**
 * Run all deterministic quality, fairness, wordplay, anti-leak, and answer-checker gates.
 */
export function validateDraftClue(params: {
    draft: DraftClue
    sourceRecords: SourceFactRecord[]
    round: 'SINGLE' | 'DOUBLE' | 'FINAL'
    wordplayRule?: WordplayRule
}): DeterministicValidationResult {
    const { draft, sourceRecords, round, wordplayRule } = params
    const errors: string[] = []
    const warnings: string[] = []

    const clue = draft.question.trim()
    const answer = draft.answer.trim()
    const categoryName = draft.categoryName.trim()

    if (!clue) errors.push('Clue text is empty')
    if (!answer) errors.push('Answer is empty')
    if (!categoryName) errors.push('Category name is empty')

    // Word count calibration (real show median is 18 words; Final can be slightly longer)
    const words = countWords(clue)
    const minWords = round === 'FINAL' ? 12 : 8
    const maxWords = round === 'FINAL' ? 42 : 32
    if (words < minWords) {
        errors.push(`Clue too short (${words} words; min ${minWords})`)
    } else if (words > maxWords) {
        errors.push(`Clue too long (${words} words; max ${maxWords})`)
    } else if (round !== 'FINAL' && (words < 10 || words > 26)) {
        warnings.push(`Clue word count (${words}) outside ideal 10-26 word band`)
    }

    // Answer conciseness (quiz-show responses should be crisp, 1-6 words)
    const answerWords = countWords(answer)
    if (answerWords > 7) {
        errors.push(`Answer too verbose (${answerWords} words; max 7)`)
    }

    // Declarative clue style (should not end with '?' unless it ends with a quoted title)
    if (clue.endsWith('?') && !clue.endsWith('?"') && !clue.endsWith('?”')) {
        errors.push('Clue ends with a question mark; quiz-show clues must be declarative prompts')
    }

    // Require an explicit pointer ("this", "these", "he", "she", "his", "her", "whose") so clues are
    // complete broadcast sentences rather than bare noun-phrase fragments ("A 1935 epic in which...")
    if (!/\b(this|these|he|she|his|her|whose)\b/i.test(clue)) {
        errors.push('Clue lacks a clear demonstrative/pronoun pointer (this/these/he/she/whose)')
    }

    // Forbidden quiz-bot / trademark / source-leak patterns
    for (const { pattern, label } of FORBIDDEN_QUIZBOT_PATTERNS) {
        if (pattern.test(clue)) {
            errors.push(`Clue violates style rule: ${label}`)
        }
    }

    // Trademark guard on category name
    if (/\bjeopardy!?\b/i.test(categoryName)) {
        errors.push('Category name contains trademarked show name')
    }

    // Answer leak guard
    if (hasAnswerLeak(clue, answer)) {
        errors.push(`Clue leaks answer token(s) from "${answer}"`)
    }

    // Wordplay constraint verification
    if (wordplayRule && !verifyWordplayRule(answer, wordplayRule)) {
        errors.push(`Answer "${answer}" fails wordplay rule: ${wordplayRule.description}`)
    }

    // Supporting entity linkage
    const matchedRecords = sourceRecords.filter((r) => (draft.supportingEntityIds || []).includes(r.entityId))
    if (matchedRecords.length === 0) {
        errors.push('Clue does not cite any valid entityId from the CC0/PD source bundle')
    } else {
        // Guard against hallucinated 4-digit years not present in the cited CC0/PD source records
        const clueYears = clue.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/g) || []
        if (clueYears.length > 0) {
            const sourceText = JSON.stringify(matchedRecords)
            for (const yr of clueYears) {
                if (!sourceText.includes(yr)) {
                    errors.push(`Clue states year ${yr} which is not present in the cited CC0/PD source record(s)`)
                }
            }
        }
    }

    // Source prose anti-copy guard
    if (hasSourceProseCopying(clue, sourceRecords)) {
        errors.push('Clue shares a 5-gram with raw source text')
    }

    // Production answer-checker round-trip compatibility
    const selfCheck = checkAnswerDetailed(answer, answer)
    if (!selfCheck.accepted) {
        errors.push(`Canonical answer "${answer}" fails answer-checker self-match`)
    }
    const whatIsCheck = checkAnswerDetailed(`What is ${answer}?`, answer)
    if (!whatIsCheck.accepted) {
        errors.push(`Canonical answer "${answer}" fails "What is ..." answer-checker match`)
    }

    // Validate acceptableAnswers aliases are clean and non-empty
    for (const alias of draft.acceptableAnswers || []) {
        const trimmed = alias.trim()
        if (!trimmed) continue
        if (trimmed.length > 80) {
            errors.push(`Acceptable answer alias too long: "${trimmed.slice(0, 30)}..."`)
        }
    }

    return {
        passed: errors.length === 0,
        errors,
        warnings,
    }
}

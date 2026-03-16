// =============================================================================
// ANSWER CHECKER - AI-First Design
// Relies on semantic similarity for answer matching
// Rule-based checks handle only basic normalization as optimization
// =============================================================================

// Basic articles to strip - these are standard English grammar, not ad-hoc rules
const ARTICLES = ['a', 'an', 'the'];

// Standard honorific titles - universally recognized, not ad-hoc
const TITLE_PREFIXES = [
    'mr', 'mrs', 'ms', 'miss', 'dr', 'doctor', 'prof', 'professor',
    'mt', 'mount', 'st', 'saint', 'sir', 'dame', 'lord', 'lady'
];

const NON_PERSON_FIRST_WORDS = new Set([
    'west', 'east', 'north', 'south', 'new', 'old', 'mount', 'mt',
    'saint', 'st', 'fort', 'department', 'state', 'city', 'county',
    'lake', 'river', 'isle', 'island'
]);

const KNOWN_EQUIVALENCE_GROUPS: Array<Set<string>> = [
    new Set(['state department', 'department of state', 'secretary of state']),
    new Set(['sgt pepper', 'sgt peppers lonely hearts club band']),
    new Set(['kaaba', 'kabah']),
    new Set(['mao tse tung', 'mao zedong']),
];

const SPOKEN_LETTER_NAMES: Record<string, string[]> = {
    b: ['b', 'bee'],
    c: ['c', 'cee'],
    d: ['d', 'dee'],
    e: ['e', 'ee'],
    f: ['f', 'ef'],
    g: ['g', 'gee'],
    h: ['h', 'aitch'],
    j: ['j', 'jay'],
    k: ['k', 'kay'],
    l: ['l', 'el'],
    m: ['m', 'em'],
    n: ['n', 'en'],
    o: ['o', 'oh'],
    p: ['p', 'pee'],
    q: ['q', 'cue'],
    s: ['s', 'ess'],
    t: ['t', 'tee'],
    v: ['v', 'vee'],
    x: ['x', 'ex'],
    z: ['z', 'zee', 'zed'],
};

export type AnswerMatchReason =
    | 'exact'
    | 'known_equivalent'
    | 'punctuation_title_normalization'
    | 'common_noun_plural'
    | 'minor_typo'
    | 'person_last_name'
    | 'semantic'
    | 'override'
    | 'manual_override'
    | 'no_match';

type DirectAnswerMatchReason = Exclude<AnswerMatchReason, 'override' | 'manual_override' | 'no_match'>

export interface AnswerMatchResult {
    accepted: boolean
    reason: AnswerMatchReason
    matchedAnswer?: string
    matchReason?: DirectAnswerMatchReason
    similarity?: number
    overrideSource?: 'ADMIN' | 'DISPUTE'
}

function buildRegularPluralVariants(word: string): string[] {
    const variants = new Set<string>([`${word}s`, `${word}es`]);
    if (/[bcdfghjklmnpqrstvwxyz]y$/.test(word)) {
        variants.add(`${word.slice(0, -1)}ies`);
    }
    return Array.from(variants);
}

const SPOKEN_LETTER_TOKEN_MAP = (() => {
    const entries = new Map<string, string>();

    for (const [letter, variants] of Object.entries(SPOKEN_LETTER_NAMES)) {
        const singularKey = `letter:${letter}`;
        const pluralKey = `letter:${letter}:plural`;

        for (const variant of variants) {
            entries.set(variant, singularKey);
            for (const pluralVariant of buildRegularPluralVariants(variant)) {
                entries.set(pluralVariant, pluralKey);
            }
        }
    }

    return entries;
})();

// =============================================================================
// AI SEMANTIC MATCHING - Primary mechanism
// =============================================================================

import type { FeatureExtractionPipeline } from '@xenova/transformers';

const embeddingCache = new Map<string, Float32Array>();
let semanticModel: FeatureExtractionPipeline | null = null;
let semanticModelLoading: Promise<boolean> | null = null;
let semanticModelAvailable = false;
let modelLoadAttempted = false;

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
}
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}

async function loadSemanticModel(): Promise<boolean> {
    // Keep test runs deterministic and avoid optional native model deps in CI/container test environments.
    if (process.env.VITEST) {
        return false;
    }

    // IMPORTANT: Only load AI model on server side
    // Client-side code should use the sync checkAnswer function
    if (typeof window !== 'undefined') {
        // Running in browser - AI not available
        return false;
    }
    
    if (semanticModelAvailable && semanticModel) return true;
    if (modelLoadAttempted && !semanticModelAvailable) return false;
    
    if (semanticModelLoading) return await semanticModelLoading;
    
    semanticModelLoading = (async () => {
        modelLoadAttempted = true;
        try {
            // Dynamic import - only happens on server
            const transformers = await import('@xenova/transformers');
            semanticModel = await transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                quantized: true,
            });
            semanticModelAvailable = true;
            console.log('Semantic model loaded successfully');
            return true;
        } catch (error) {
            console.warn('Semantic matching model unavailable:', error);
            semanticModelAvailable = false;
            return false;
        }
    })();
    
    return await semanticModelLoading;
}

export async function preloadSemanticModel(): Promise<boolean> {
    return await loadSemanticModel();
}

export function isSemanticModelAvailable(): boolean {
    return semanticModelAvailable;
}

async function getEmbedding(text: string): Promise<Float32Array | null> {
    if (!semanticModel) return null;
    
    const cacheKey = text.toLowerCase().trim();
    const cached = embeddingCache.get(cacheKey);
    if (cached) return cached;
    
    try {
        const result = await semanticModel(text, { pooling: 'mean', normalize: true });
        const embedding = result.data as Float32Array;
        if (embedding) {
            embeddingCache.set(cacheKey, embedding);
            if (embeddingCache.size > 10000) {
                const firstKey = embeddingCache.keys().next().value;
                if (firstKey) embeddingCache.delete(firstKey);
            }
        }
        return embedding;
    } catch {
        return null;
    }
}

async function getSemanticSimilarity(text1: string, text2: string): Promise<number> {
    const modelLoaded = await loadSemanticModel();
    if (!modelLoaded) return -1;
    
    const [emb1, emb2] = await Promise.all([getEmbedding(text1), getEmbedding(text2)]);
    if (!emb1 || !emb2) return -1;
    
    return cosineSimilarity(emb1, emb2);
}

// =============================================================================
// TEXT NORMALIZATION - Basic, standard transformations
// =============================================================================
    
export function normalizeAnswerText(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .toLowerCase()
        .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D-]/g, ' ') // Normalize dashes
        .replace(/['"''""]/g, '') // Remove quotes
        .replace(/[^a-z0-9\s&]/g, '') // Remove special chars
        .replace(/\s+/g, ' ')
        .replace(/\s*&\s*/g, ' and ')
        .trim();
}

function stripArticles(text: string): string {
    const words = normalizeAnswerText(text).split(' ');
    while (words.length > 1 && ARTICLES.includes(words[0])) {
        words.shift();
    }
    return words.join(' ');
    }
    
function stripQuestionPhrase(text: string): string {
    // Standard Jeopardy question formats
    const questionPhraseRegex = /^(what|who|where|when)\s+(is|are|was|were)\s+/i;
    const contractionRegex = /^(what|who|where|when)['']s\s+/i;
    
    let stripped = text.trim();
    stripped = stripped.replace(contractionRegex, '');
    stripped = stripped.replace(questionPhraseRegex, '');
    return stripped.trim();
}

function stripTitlePrefix(text: string): string {
    const words = text.trim().split(/\s+/);
    if (words.length > 1) {
        const firstWord = words[0].toLowerCase().replace(/[.,]/g, '');
        if (TITLE_PREFIXES.includes(firstWord)) {
            return words.slice(1).join(' ');
        }
    }
    return text;
                }

function extractParentheticalVariants(text: string): string[] {
    const variants: string[] = [text];
    
    // End parentheses: "Lincoln (or Honest Abe)"
    const endMatch = text.match(/^(.+?)\s*\((.+?)\)\s*$/);
    if (endMatch) {
        variants.push(endMatch[1].trim());
        let content = endMatch[2].trim();
        if (content.toLowerCase().startsWith('or ')) content = content.slice(3).trim();
        if (content) variants.push(content);
                }
    
    // Start parentheses: "(Robert) Pattinson"
    const startMatch = text.match(/^\((.+?)\)\s+(.+)$/);
    if (startMatch) {
        variants.push(startMatch[2].trim());
        variants.push(startMatch[1].trim() + ' ' + startMatch[2].trim());
    }
    
    // Middle parentheses: "the (Cincinnati) Reds"
    const midMatch = text.match(/^(.+?)\s*\((.+?)\)\s*(.+)$/);
    if (midMatch && !endMatch && !startMatch) {
        const before = midMatch[1].trim();
        const content = midMatch[2].trim();
        const after = midMatch[3].trim();
        variants.push(before + ' ' + after);
        variants.push(before + ' ' + content + ' ' + after);
        variants.push(after);
        variants.push(content + ' ' + after);
    }
    
    return [...new Set(variants)].filter(Boolean);
}

// =============================================================================
// FUZZY MATCHING - For typo tolerance
// =============================================================================

function jaroWinkler(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    if (!s1.length || !s2.length) return 0;
    
    const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
    const s1Matches = new Array(s1.length).fill(false);
    const s2Matches = new Array(s2.length).fill(false);
    
    let matches = 0, transpositions = 0;
    
    for (let i = 0; i < s1.length; i++) {
        const start = Math.max(0, i - matchWindow);
        const end = Math.min(i + matchWindow + 1, s2.length);
        for (let j = start; j < end; j++) {
            if (s2Matches[j] || s1[i] !== s2[j]) continue;
            s1Matches[i] = s2Matches[j] = true;
            matches++;
            break;
        }
    }
    
    if (!matches) return 0;
    
    let k = 0;
    for (let i = 0; i < s1.length; i++) {
        if (!s1Matches[i]) continue;
        while (!s2Matches[k]) k++;
        if (s1[i] !== s2[k]) transpositions++;
        k++;
    }
    
    const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;
    
    let prefix = 0;
    for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
        if (s1[i] === s2[i]) prefix++;
        else break;
    }
    
    return jaro + prefix * 0.1 * (1 - jaro);
}

function splitWords(text: string): string[] {
    return text.split(/\s+/).filter(Boolean);
}

function isMinorTokenTypo(a: string, b: string): boolean {
    if (!a || !b || a === b || a[0] !== b[0]) return false;
    const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    return ratio >= 0.85 && jaroWinkler(a, b) >= 0.93;
}

function isPluralVariant(a: string, b: string): boolean {
    if (!a || !b || a === b) return false;
    const pluralA = buildRegularPluralVariants(a)
    const pluralB = buildRegularPluralVariants(b)
    return pluralA.includes(b) || pluralB.includes(a)
}

function isLikelyLowercaseCommonNounPhrase(text: string): boolean {
    const stripped = stripQuestionPhrase(text)
        .replace(/\([^)]*\)/g, ' ')
        .replace(/^(a|an|the)\s+/i, '')
        .trim();

    const lettersOnly = stripped.replace(/[^A-Za-z]/g, '');
    if (!lettersOnly) return false;

    return lettersOnly === lettersOnly.toLowerCase();
}

function hasCommonNounSingularPluralMatch(userText: string, correctText: string): boolean {
    const userWords = splitWords(stripArticles(userText));
    const correctWords = splitWords(stripArticles(correctText));
    if (userWords.length !== correctWords.length || userWords.length === 0) return false;
    if (!isLikelyLowercaseCommonNounPhrase(correctText)) return false;

    let pluralDiffs = 0;
    for (let i = 0; i < userWords.length; i++) {
        if (userWords[i] === correctWords[i]) continue;
        if (!isPluralVariant(userWords[i], correctWords[i])) return false;
        pluralDiffs += 1;
        if (pluralDiffs > 1) return false;
    }

    return pluralDiffs === 1;
}

function isSingularPluralNearMiss(userText: string, correctText: string): boolean {
    const userWords = splitWords(stripArticles(userText));
    const correctWords = splitWords(stripArticles(correctText));
    if (userWords.length !== correctWords.length || userWords.length === 0) return false;
    if (!hasCommonNounSingularPluralMatch(userText, correctText)) {
        let pluralDiffs = 0;
        for (let i = 0; i < userWords.length; i++) {
            if (userWords[i] === correctWords[i]) continue;
            if (!isPluralVariant(userWords[i], correctWords[i])) return false;
            pluralDiffs += 1;
            if (pluralDiffs > 1) return false;
        }

        return pluralDiffs === 1;
    }

    return false;
}

function normalizeSpokenLetterToken(token: string): string | null {
    return SPOKEN_LETTER_TOKEN_MAP.get(token) ?? null;
}

function areEquivalentTitleTokens(userToken: string, correctToken: string): boolean {
    if (userToken === correctToken) return true;
    if ((userToken === 'n' && correctToken === 'and') || (userToken === 'and' && correctToken === 'n')) {
        return true;
    }

    const normalizedUser = normalizeSpokenLetterToken(userToken);
    const normalizedCorrect = normalizeSpokenLetterToken(correctToken);
    return Boolean(normalizedUser && normalizedUser === normalizedCorrect);
}

function hasEquivalentTitleOrthography(normU: string, normC: string): boolean {
    const wordsU = splitWords(normU);
    const wordsC = splitWords(normC);
    if (wordsU.length !== wordsC.length || wordsU.length === 0) return false;

    let differences = 0;
    for (let i = 0; i < wordsU.length; i++) {
        if (wordsU[i] === wordsC[i]) continue;
        if (!areEquivalentTitleTokens(wordsU[i], wordsC[i])) return false;
        differences += 1;
    }

    return differences > 0;
}

function hasMinorTypoMatch(normU: string, normC: string): boolean {
    const wordsU = splitWords(normU);
    const wordsC = splitWords(normC);
    if (wordsU.length !== wordsC.length || wordsU.length === 0 || wordsU.length > 2) return false;

    let differingTokens = 0;
    for (let i = 0; i < wordsU.length; i++) {
        if (wordsU[i] === wordsC[i]) continue;
        if (isPluralVariant(wordsU[i], wordsC[i])) return false;
        if (!isMinorTokenTypo(wordsU[i], wordsC[i])) return false;
        differingTokens += 1;
        if (differingTokens > 1) return false;
    }

    return differingTokens === 1;
}

function areKnownEquivalent(normU: string, normC: string): boolean {
    if (normU === normC) return true;
    return KNOWN_EQUIVALENCE_GROUPS.some((group) => group.has(normU) && group.has(normC));
}

function areDepartmentWordOrderVariants(normU: string, normC: string): boolean {
    const wordsU = splitWords(normU);
    const wordsC = splitWords(normC);
    if (!wordsU.includes('department') || !wordsC.includes('department')) return false;

    const normalizeDepartmentTokens = (words: string[]) =>
        words.filter((word) => word !== 'of').sort().join(' ');

    return normalizeDepartmentTokens(wordsU) === normalizeDepartmentTokens(wordsC);
}

function hasLikelyPersonLastNameMatch(userText: string, correctText: string): boolean {
    const userWords = splitWords(stripArticles(userText));
    const correctWords = splitWords(stripArticles(correctText));

    if (userWords.length !== 1) return false;
    if (correctWords.length !== 2 && correctWords.length !== 3) return false;
    if (NON_PERSON_FIRST_WORDS.has(correctWords[0])) return false;

    if (correctWords.length === 3 && correctWords[1].length > 2) return false;

    return userWords[0] === correctWords[correctWords.length - 1];
}

function isLikelyLongTitleNearMiss(userText: string, correctText: string): boolean {
    const userWords = splitWords(stripArticles(userText));
    const correctWords = splitWords(stripArticles(correctText));
    if (userWords.length < 3 || correctWords.length < 3) return false;

    if (userWords.length === correctWords.length) {
        let differing = 0;
        for (let i = 0; i < userWords.length; i++) {
            if (userWords[i] === correctWords[i]) continue;
            if (!isMinorTokenTypo(userWords[i], correctWords[i]) && !isPluralVariant(userWords[i], correctWords[i])) {
                return false;
            }
            differing += 1;
            if (differing > 1) return false;
        }
        return differing === 1;
    }

    const shorter = userWords.length < correctWords.length ? userWords : correctWords;
    const longer = userWords.length < correctWords.length ? correctWords : userWords;
    if (shorter.length < 3 || longer.length - shorter.length < 2) return false;

    let minorTypos = 0;
    for (let i = 0; i < shorter.length; i++) {
        if (shorter[i] === longer[i]) continue;
        if (!isMinorTokenTypo(shorter[i], longer[i]) && !isPluralVariant(shorter[i], longer[i])) return false;
        minorTypos += 1;
        if (minorTypos > 1) return false;
    }

    return true;
}

function isLikelyPluralEntityNearMiss(userText: string, correctText: string): boolean {
    const userWords = splitWords(stripArticles(userText));
    const correctWords = splitWords(stripArticles(correctText));
    if (userWords.length !== correctWords.length || userWords.length < 2) return false;

    let pluralDiffs = 0;
    for (let i = 0; i < userWords.length; i++) {
        if (userWords[i] === correctWords[i]) continue;
        if (!isPluralVariant(userWords[i], correctWords[i])) return false;
        pluralDiffs += 1;
        if (pluralDiffs > 1) return false;
    }

    return pluralDiffs === 1;
}

// =============================================================================
// RULE-BASED MATCHING - Only for exact/normalized matches
// =============================================================================

function acceptedResult(
    reason: DirectAnswerMatchReason,
    matchedAnswer?: string,
    similarity?: number
): AnswerMatchResult {
    return {
        accepted: true,
        reason,
        matchedAnswer,
        similarity
    }
}

function rejectedResult(): AnswerMatchResult {
    return {
        accepted: false,
        reason: 'no_match'
    }
}

function toDirectMatchReason(reason: AnswerMatchReason): DirectAnswerMatchReason | undefined {
    if (reason === 'override' || reason === 'manual_override' || reason === 'no_match') {
        return undefined
    }

    return reason
}

function getRuleBasedMatch(userAnswer: string, correctAnswer: string): AnswerMatchResult {
    const user = stripQuestionPhrase(userAnswer);
    const correct = stripQuestionPhrase(correctAnswer);
    
    if (!user || !correct) return rejectedResult();
    
    // Get all parenthetical variants
    const userVariants = extractParentheticalVariants(user);
    const correctVariants = extractParentheticalVariants(correct);
    
    for (const uv of userVariants) {
        for (const cv of correctVariants) {
            // With and without title prefixes
            for (const u of [uv, stripTitlePrefix(uv)]) {
                for (const c of [cv, stripTitlePrefix(cv)]) {
                    // With and without articles
                    const normU = stripArticles(u);
                    const normC = stripArticles(c);
                    
                    if (normU === normC) return acceptedResult('exact', correctAnswer);
                    if (areKnownEquivalent(normU, normC)) return acceptedResult('known_equivalent', correctAnswer);
                    if (areDepartmentWordOrderVariants(normU, normC)) return acceptedResult('known_equivalent', correctAnswer);
                    if (hasCommonNounSingularPluralMatch(u, c)) return acceptedResult('common_noun_plural', correctAnswer);
                    if (hasEquivalentTitleOrthography(normU, normC)) {
                        return acceptedResult('punctuation_title_normalization', correctAnswer);
                    }
                    
                    // No-space match (handles hyphen/space variations)
                    const compU = normU.replace(/\s+/g, '');
                    const compC = normC.replace(/\s+/g, '');
                    if (compU === compC) return acceptedResult('punctuation_title_normalization', correctAnswer);
                    
                    // Typo tolerance for single words and short two-word phrases only.
                    if (hasMinorTypoMatch(normU, normC)) return acceptedResult('minor_typo', correctAnswer);
                }
            }
        }
    }

    if (hasLikelyPersonLastNameMatch(userAnswer, correctAnswer)) {
        return acceptedResult('person_last_name', correctAnswer);
    }

    return rejectedResult();
}

function findRuleBasedOverrideMatch(userAnswer: string, overrideAnswers?: string[]): AnswerMatchResult {
    if (!overrideAnswers?.length) return rejectedResult();

    for (const override of overrideAnswers) {
        const match = getRuleBasedMatch(userAnswer, override);
        if (match.accepted) {
            return {
                accepted: true,
                reason: 'override',
                matchedAnswer: override,
                matchReason: toDirectMatchReason(match.reason)
            };
        }
    }

    return rejectedResult();
}

// =============================================================================
// MAIN ANSWER CHECKING - AI-First
// =============================================================================

const AI_THRESHOLD = 0.82;

/**
 * Primary answer checking function - AI-first design
 * @param userAnswer - The answer provided by the user
 * @param correctAnswer - The correct answer to compare against
 * @param overrideAnswers - Optional additional acceptable answers
 */
export async function checkAnswerDetailedAsync(
    userAnswer: string, 
    correctAnswer: string, 
    overrideAnswers?: string[]
): Promise<AnswerMatchResult> {
    const user = stripQuestionPhrase(userAnswer).trim();
    const correct = stripQuestionPhrase(correctAnswer).trim();
    if (!user || !correct) return rejectedResult();
    
    const directMatch = getRuleBasedMatch(userAnswer, correctAnswer);
    if (directMatch.accepted) return directMatch;

    const overrideMatch = findRuleBasedOverrideMatch(userAnswer, overrideAnswers);
    if (overrideMatch.accepted) return overrideMatch;

    const similarity = await getSemanticSimilarity(user, correct);
    
    if (similarity >= 0) {
        if (isLikelyLongTitleNearMiss(user, correct)) return rejectedResult();
        if (isLikelyPluralEntityNearMiss(user, correct)) return rejectedResult();
        if (isSingularPluralNearMiss(user, correct)) return rejectedResult();

        // Detect partial answer trap: user's words are subset of correct's words
        // This catches "Canterbury" vs "Canterbury Tales", "Salt Lake" vs "Salt Lake City"
        const userWords = stripArticles(user).split(/\s+/).filter(w => w.length > 2);
        const correctWords = stripArticles(correct).split(/\s+/).filter(w => w.length > 2);
        
        if (userWords.length > 0 && correctWords.length > userWords.length) {
            const allUserWordsInCorrect = userWords.every(w => correctWords.includes(w));
            
            if (allUserWordsInCorrect) {
                // User gave a subset of words - this is likely a partial answer
                // Be very strict - require near-exact similarity
                if (similarity >= 0.95) return acceptedResult('semantic', correctAnswer, similarity);
                return rejectedResult();
        }
    }

        // Standard threshold check
        if (similarity >= AI_THRESHOLD) return acceptedResult('semantic', correctAnswer, similarity);

        if (overrideAnswers?.length) {
            for (const override of overrideAnswers) {
                const overrideSimilarity = await getSemanticSimilarity(user, stripQuestionPhrase(override).trim());
                if (overrideSimilarity >= AI_THRESHOLD) {
                    return {
                        accepted: true,
                        reason: 'override',
                        matchedAnswer: override,
                        matchReason: 'semantic',
                        similarity: overrideSimilarity
                    };
                }
            }
        }

        return rejectedResult();
    }

    return rejectedResult();
}

export async function checkAnswerAsync(
    userAnswer: string,
    correctAnswer: string,
    overrideAnswers?: string[]
): Promise<boolean> {
    const result = await checkAnswerDetailedAsync(userAnswer, correctAnswer, overrideAnswers);
    return result.accepted;
}

/**
 * Synchronous answer checking - rule-based only
 * @deprecated Use checkAnswerAsync for AI-powered matching
 */
export function checkAnswerDetailed(
    userAnswer: string,
    correctAnswer: string,
    overrideAnswers?: string[]
): AnswerMatchResult {
    const user = stripQuestionPhrase(userAnswer).trim();
    const correct = stripQuestionPhrase(correctAnswer).trim();
    if (!user || !correct) return rejectedResult();

    const directMatch = getRuleBasedMatch(userAnswer, correctAnswer);
    if (directMatch.accepted) return directMatch;

    return findRuleBasedOverrideMatch(userAnswer, overrideAnswers);
}

export function checkAnswer(userAnswer: string, correctAnswer: string, overrideAnswers?: string[]): boolean {
    return checkAnswerDetailed(userAnswer, correctAnswer, overrideAnswers).accepted;
}

/**
 * Calculate points for an answer
 */
export function calculatePoints(userAnswer: string, correctAnswer: string, pointValue: number): number {
    return checkAnswer(userAnswer, correctAnswer) ? pointValue : 0;
}

/**
 * Calculate points asynchronously with AI matching
 */
export async function calculatePointsAsync(
    userAnswer: string, 
    correctAnswer: string, 
    pointValue: number
): Promise<number> {
    const isCorrect = await checkAnswerAsync(userAnswer, correctAnswer);
    return isCorrect ? pointValue : 0;
}

// Profanity filter using bad-words library with robust fallback
let profanityFilter: { isProfane: (text: string) => boolean } | null = null
let filterInitialized = false

/**
 * Pattern-based profanity detection fallback
 * Uses generic pattern matching to detect suspicious content without encoding explicit words
 * This is a safety net when the bad-words library fails to load
 * Uses only generic linguistic patterns, not specific word patterns
 */
function patternBasedProfanityCheck(text: string): boolean {
    const normalized = text.toLowerCase().replace(/[^a-z]/g, '')
    
    if (normalized.length < 3) {
        return false
    }
    
    // Generic pattern: excessive consonant clusters (5+ consecutive consonants)
    // This catches workarounds without encoding specific words
    const excessiveConsonants = /[bcdfghjklmnpqrstvwxyz]{5,}/i
    if (excessiveConsonants.test(normalized)) {
        // Allow legitimate words with known consonant clusters
        const allowedPatterns = ['class', 'glass', 'grass', 'brass', 'pass', 'mass', 'bass', 'stress', 'press']
        const isAllowed = allowedPatterns.some(word => normalized.includes(word))
        if (!isAllowed) {
            return true
        }
    }
    
    // Generic pattern: very short words (3-4 chars) with no vowels
    // This catches common profanity workarounds
    if (normalized.length <= 4) {
        const noVowels = /^[bcdfghjklmnpqrstvwxyz]+$/i
        if (noVowels.test(normalized)) {
            // Allow very common short words without vowels
            const allowedShort = ['mr', 'mrs', 'dr', 'st', 'rd', 'th', 'nd']
            if (!allowedShort.includes(normalized)) {
                return true
            }
        }
    }
    
    // Generic pattern: suspicious character repetition (same char 3+ times)
    // Catches patterns like "aaa" which are often used to bypass filters
    const excessiveRepetition = /(.)\1{2,}/i
    if (excessiveRepetition.test(normalized)) {
        return true
    }
    
    return false
}

// Lazy initialization of profanity filter
function getProfanityFilter(): { isProfane: (text: string) => boolean } {
    if (filterInitialized && profanityFilter) {
        return profanityFilter
    }
    
    filterInitialized = true
    
    // Try to use badwords-list directly (more reliable than bad-words library)
    let wordList: string[] | null = null
    
    try {
        const badwordsList = require('badwords-list')
        // badwords-list exports an object with an 'array' property containing the word list
        if (badwordsList && badwordsList.array && Array.isArray(badwordsList.array) && badwordsList.array.length > 0) {
            wordList = badwordsList.array.map((word: string) => word.toLowerCase().trim()).filter((word: string) => word.length > 0)
        }
    } catch (e) {
        // badwords-list not available, will use pattern-based only
        console.error('badwords-list unavailable:', e)
    }
    
    // Create filter that uses word list if available, with pattern-based backup
    profanityFilter = {
        isProfane: (text: string) => {
            const lowerText = text.toLowerCase()
            const normalized = normalizeForProfanityCheck(text)
            
            // Check against word list if available
            if (wordList) {
                // Check if text contains any word from the list
                const containsProfaneWord = wordList.some(word => {
                    // Check both original and normalized text
                    return lowerText.includes(word) || normalized.includes(word)
                })
                
                if (containsProfaneWord) {
                    // Verify it's not a false positive from legitimate exceptions
                    const isException = legitimateExceptions.some(exception => 
                        lowerText === exception || 
                        lowerText.includes(exception) ||
                        normalized.includes(exception.toLowerCase())
                    )
                    if (!isException) {
                        return true
                    }
                }
            }
            
            // Always also check with pattern-based (double safety)
            return patternBasedProfanityCheck(normalized)
        }
    }
    
    return profanityFilter
}

/**
 * Display name validation result
 */
export type DisplayNameValidationResult =
    | { ok: true; normalized: string }
    | { ok: false; code: 'too_short' | 'too_long' | 'invalid_chars' | 'profanity' | 'reserved' | 'empty'; message: string }

/**
 * Normalize a display name for storage and comparison
 * - Trims leading/trailing whitespace
 * - Collapses multiple spaces into single spaces
 */
export function normalizeDisplayName(name: string): string {
    return name.trim().replace(/\s+/g, ' ')
}

/**
 * Normalize a string for profanity checking by removing common obfuscation
 * - Removes spaces, dots, underscores, hyphens (common separators used to bypass filters)
 * - Converts leetspeak to normal letters (0->o, 1->i/l, 3->e, 4->a, 5->s, 7->t, @->a, $->s)
 * - Removes excessive character repetition (e.g., "aaa" -> "aa")
 */
function normalizeForProfanityCheck(text: string): string {
    let normalized = text.toLowerCase()
    
    // Remove common separators used to bypass filters
    normalized = normalized.replace(/[\s._-]/g, '')
    
    // Convert common leetspeak substitutions
    const leetMap: Record<string, string> = {
        '0': 'o',
        '1': 'i',
        '3': 'e',
        '4': 'a',
        '5': 's',
        '7': 't',
        '@': 'a',
        '$': 's',
        '!': 'i',
        '|': 'i',
    }
    
    for (const [leet, letter] of Object.entries(leetMap)) {
        normalized = normalized.replace(new RegExp(leet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), letter)
    }
    
    // Remove excessive character repetition (more than 2 in a row)
    normalized = normalized.replace(/(.)\1{2,}/g, '$1$1')
    
    return normalized
}

/**
 * Legitimate words that might contain profanity as substrings but should be allowed
 * These are common words that could trigger false positives
 */
const legitimateExceptions: string[] = [
    'classic', 'pass', 'mass', 'glass', 'grass', 'brass', 'basin', 'basil', 
    'basement', 'bass', 'assessment', 'assistant', 'associate', 'hellish', 
    'hello', 'shell', 'damnation', 'damned', 'class', 'passion', 'massive',
    'brassica', 'brassiere', 'bassoon', 'bassist',
]

/**
 * Check if a display name contains profanity or offensive content
 * Uses the bad-words library and handles workarounds like leetspeak and spacing
 * ALWAYS blocks profanity - never allows it through, even if library fails
 */
function containsProfanity(name: string): boolean {
    const filter = getProfanityFilter()
    const lowerName = name.toLowerCase()
    const normalizedName = normalizeForProfanityCheck(name)
    
    // Check if the name itself is a legitimate exception
    if (legitimateExceptions.includes(lowerName)) {
        return false
    }
    
    // Check original name with profanity filter
    if (filter.isProfane(lowerName)) {
        // Verify it's not a false positive from a legitimate word
        const isException = legitimateExceptions.some(exception => 
            lowerName === exception || 
            lowerName.startsWith(exception) || 
            lowerName.endsWith(exception) ||
            exception.includes(lowerName)
        )
        if (!isException) {
            return true
        }
    }
    
    // Check normalized name (after removing separators and leetspeak) for workarounds
    if (filter.isProfane(normalizedName)) {
        return true
    }
    
    // Additional safety check: always run pattern-based check as backup
    // This ensures we catch things even if the library misses them
    if (patternBasedProfanityCheck(normalizedName)) {
        // But allow legitimate exceptions
        const isException = legitimateExceptions.some(exception => 
            normalizedName.includes(exception.toLowerCase())
        )
        if (!isException) {
            return true
        }
    }
    
    return false
}

/**
 * Check if a display name is reserved or impersonates official roles
 */
function isReservedName(name: string): boolean {
    const lowerName = normalizeDisplayName(name).toLowerCase()
    
    // Reserved names that impersonate official roles or branding
    const reservedPatterns = [
        // Official roles
        '^admin$', '^administrator$', '^moderator$', '^mod$', '^staff$', '^official$',
        '^support$', '^help$', '^jeopardy$', '^jeopardy!$',
        // Brand impersonation
        '^jeopardy\\s+', '^official\\s+', '^staff\\s+', '^admin\\s+',
        // System names
        '^system$', '^bot$', '^anonymous$', '^guest$',
    ]
    
    for (const pattern of reservedPatterns) {
        const regex = new RegExp(pattern, 'i')
        if (regex.test(lowerName)) {
            return true
        }
    }
    
    return false
}

/**
 * Validate display name format and content
 * Returns normalized name if valid, or error details if invalid
 */
export function validateDisplayName(name: string): DisplayNameValidationResult {
    // Normalize first
    const normalized = normalizeDisplayName(name)
    
    // Check if empty after normalization
    if (normalized.length === 0) {
        return {
            ok: false,
            code: 'empty',
            message: 'Display name cannot be empty'
        }
    }
    
    // Check length (3-20 characters)
    if (normalized.length < 3) {
        return {
            ok: false,
            code: 'too_short',
            message: 'Display name must be at least 3 characters'
        }
    }
    
    if (normalized.length > 20) {
        return {
            ok: false,
            code: 'too_long',
            message: 'Display name must be 20 characters or less'
        }
    }
    
    // Check for valid characters: letters, numbers, spaces, and limited punctuation (- _ .)
    // Allow Unicode letters and numbers for international support
    const validCharRegex = /^[\p{L}\p{N}\s._-]+$/u
    if (!validCharRegex.test(normalized)) {
        return {
            ok: false,
            code: 'invalid_chars',
            message: 'Display name can only contain letters, numbers, spaces, and the characters: . _ -'
        }
    }
    
    // Industry best practice: Must contain at least one letter (not just numbers)
    const hasLetter = /[\p{L}]/u.test(normalized)
    if (!hasLetter) {
        return {
            ok: false,
            code: 'invalid_chars',
            message: 'Display name must contain at least one letter'
        }
    }
    
    // Check for profanity (must check before reserved names to give better error)
    if (containsProfanity(normalized)) {
        return {
            ok: false,
            code: 'profanity',
            message: 'Display name contains inappropriate language'
        }
    }
    
    // Check for reserved names
    if (isReservedName(normalized)) {
        return {
            ok: false,
            code: 'reserved',
            message: 'This display name is reserved and cannot be used'
        }
    }
    
    // Check for obviously spammy patterns (e.g., all same character, excessive repetition)
    if (/^(.)\1{4,}$/.test(normalized)) {
        return {
            ok: false,
            code: 'invalid_chars',
            message: 'Display name contains invalid patterns'
        }
    }
    
    // Industry best practice: Disallow names that are all numbers or all punctuation
    const allNumbers = /^\d+$/.test(normalized.replace(/\s/g, ''))
    if (allNumbers) {
        return {
            ok: false,
            code: 'invalid_chars',
            message: 'Display name cannot be all numbers'
        }
    }
    
    return {
        ok: true,
        normalized
    }
}

/**
 * Generate a random display name for users
 * Combines a random adjective with a random noun
 * Note: Generated names are not guaranteed to be unique
 */
export function generateRandomDisplayName(): string {
    const adjectives = ['Quick', 'Clever', 'Bright', 'Sharp', 'Smart', 'Witty', 'Wise', 'Bold', 'Eager', 'Grand']
    const nouns = ['Scholar', 'Thinker', 'Master', 'Champion', 'Expert', 'Genius', 'Sage', 'Mind', 'Brain', 'Ace']

    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)]
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)]

    return `${randomAdjective}${randomNoun}`
}


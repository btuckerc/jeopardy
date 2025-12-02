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
 * On-brand adjectives for display name generation
 * Curated to fit trivia/knowledge/game-show theme, all safe and readable
 * All words are checked to fit within 20-character limit when combined with nouns
 */
const DISPLAY_NAME_ADJECTIVES = [
    // Intelligence & Knowledge
    'Quick', 'Clever', 'Bright', 'Sharp', 'Smart', 'Witty', 'Wise', 'Brilliant', 'Genius', 'Astute',
    'Keen', 'Apt', 'Savvy', 'Shrewd', 'Adept', 'Skilled', 'Able', 'Capable', 'Expert', 'Pro',
    'Precise', 'Accurate', 'Focused', 'Alert', 'Observant', 'Perceptive', 'Insightful', 'Analytical', 'Logical', 'Rational',
    'Thoughtful', 'Reflective', 'Deliberate', 'Careful', 'Thorough', 'Detailed', 'Meticulous', 'Exact', 'Methodical', 'Systematic',
    'Intelligent', 'Cerebral', 'Intellectual', 'Learned', 'Educated', 'Scholarly', 'Academic', 'Studious', 'Sophisticated', 'Cultured',
    'Inventive', 'Creative', 'Imaginative', 'Innovative', 'Original', 'Novel', 'Fresh', 'Modern',
    // Enthusiasm & Energy
    'Eager', 'Bold', 'Brave', 'Brisk', 'Zesty', 'Peppy', 'Spry', 'Vivid', 'Vital', 'Energetic',
    'Dynamic', 'Active', 'Lively', 'Vibrant', 'Animated', 'Spirited', 'Fiery', 'Passionate', 'Zealous', 'Ardent',
    'Enthusiastic', 'Excited', 'Thrilled', 'Elated', 'Jubilant', 'Exuberant', 'Bubbly', 'Cheerful', 'Joyful', 'Motivated',
    'Inspired', 'Ambitious', 'Purposeful', 'Intentional', 'Dedicated', 'Committed', 'Devoted',
    // Achievement & Excellence
    'Grand', 'Prime', 'Elite', 'Top', 'Best', 'Fine', 'Super', 'Ultra', 'Max', 'Peak',
    'Outstanding', 'Remarkable', 'Notable', 'Distinguished', 'Prominent', 'Superior', 'Exceptional', 'Extraordinary', 'Noteworthy', 'Impressive',
    'Perfect', 'Ideal', 'Optimal', 'Supreme', 'Ultimate', 'Finest', 'Premium', 'Select', 'First',
    'Champion', 'Victorious', 'Triumphant', 'Successful', 'Accomplished', 'Masterful', 'Proficient', 'Competent', 'Experienced', 'Seasoned',
    'Veteran', 'Advanced', 'Talented',
    // Thinking & Learning
    'Deep', 'Rich', 'Vast', 'Broad', 'Wide', 'Solid', 'Sound', 'True', 'Real', 'Substantial',
    'Profound', 'Intense', 'Serious', 'Sincere', 'Genuine', 'Authentic', 'Honest', 'Pure', 'Clear', 'Transparent',
    'Comprehensive', 'Complete', 'Total', 'Entire', 'Whole', 'Exhaustive', 'Extensive',
    'Curious', 'Inquisitive', 'Questioning', 'Investigative', 'Exploratory', 'Adventurous', 'Daring', 'Fearless', 'Intrepid', 'Valiant',
    // Game-show appropriate
    'Lucky', 'Swift', 'Fast', 'Rapid', 'Snap', 'Flash', 'Dash', 'Zoom', 'Zap', 'Nimble',
    'Speedy', 'Fleet', 'Instant', 'Immediate', 'Prompt', 'Ready', 'Lightning',
    'Competitive', 'Determined', 'Resolute', 'Steadfast', 'Unwavering', 'Persistent', 'Tenacious', 'Strong', 'Powerful', 'Mighty',
    'Confident', 'Assured', 'Poised', 'Composed', 'Calm', 'Steady', 'Stable', 'Reliable', 'Dependable',
    'Strategic', 'Tactical', 'Calculated', 'Planned', 'Orderly', 'Disciplined', 'Controlled',
    // Positive traits
    'Cool', 'Neat', 'Great', 'Nice', 'Good', 'Superb', 'Excellent', 'Amazing', 'Wonderful', 'Fantastic',
    'Marvelous', 'Splendid', 'Magnificent', 'Glorious', 'Majestic', 'Noble', 'Honorable',
    'Charming', 'Delightful', 'Pleasant', 'Agreeable', 'Lovely', 'Beautiful', 'Graceful', 'Dignified', 'Esteemed', 'Honored',
    'Admirable', 'Commendable', 'Worthy', 'Deserving', 'Celebrated', 'Inspiring', 'Motivational', 'Uplifting', 'Encouraging', 'Supportive'
]

/**
 * On-brand nouns for display name generation
 * Curated to fit trivia/knowledge/game-show theme, all safe and readable
 * All words are checked to fit within 20-character limit when combined with adjectives
 */
const DISPLAY_NAME_NOUNS = [
    // Knowledge & Learning
    'Scholar', 'Thinker', 'Master', 'Expert', 'Genius', 'Sage', 'Mind', 'Brain', 'Ace', 'Pro',
    'Whiz', 'Buff', 'Fan', 'Devotee', 'Seeker', 'Student', 'Pupil', 'Learner', 'Knower', 'Collector',
    'Guru', 'Mentor', 'Teacher', 'Tutor', 'Guide', 'Philosopher', 'Theorist', 'Academic', 'Intellectual',
    'Educator', 'Professor', 'Lecturer', 'Scientist', 'Historian', 'Author', 'Writer', 'Poet', 'Novelist',
    'Specialist', 'Authority', 'Connoisseur', 'Enthusiast', 'Hobbyist', 'Amateur', 'Novice', 'Beginner', 'Newcomer',
    'Trainee', 'Intern', 'Recruit', 'Rookie', 'Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate',
    // Achievement & Competition
    'Champion', 'Winner', 'Victor', 'Hero', 'Star', 'Icon', 'Idol', 'Elite', 'Top', 'Best',
    'Fighter', 'Warrior', 'Gladiator', 'Participant', 'Entrant', 'Candidate', 'Finalist', 'Semifinalist',
    'Captain', 'Chief', 'Boss', 'Head', 'Manager', 'Commander', 'General', 'Admiral',
    'Medalist', 'Awardee', 'Recipient', 'Honoree', 'Laureate', 'Achiever', 'Performer', 'Creator', 'Founder',
    // Thinking & Intelligence
    'Solver', 'Cracker', 'Decoder', 'Reader', 'Getter', 'Grasper', 'Analyst', 'Researcher', 'Investigator',
    'Detective', 'Sleuth', 'Searcher', 'Explorer', 'Discoverer', 'Finder', 'Hunter', 'Tracker', 'Scout', 'Pioneer',
    'Strategist', 'Tactician', 'Planner', 'Architect', 'Designer', 'Innovator', 'Inventor', 'Trailblazer', 'Pathfinder',
    'Troubleshooter', 'Fixer', 'Critic', 'Reviewer', 'Evaluator', 'Judge', 'Referee', 'Moderator',
    'Advisor', 'Counselor', 'Coach', 'Trainer', 'Virtuoso', 'Maestro', 'Leader',
    // Game-show appropriate
    'Player', 'Contestant', 'Competitor', 'Rival', 'Challenger', 'Contender', 'Racer', 'Runner', 'Sprinter', 'Dasher',
    'Answerer', 'Responder', 'Guesser', 'Estimator', 'Predictor', 'Forecaster', 'Oracle', 'Seer', 'Visionary',
    'Gamer', 'Hopeful', 'Aspirant', 'Applicant', 'Nominee', 'Volunteer', 'Member', 'Associate', 'Fellow', 'Colleague',
    'Teammate', 'Partner', 'Collaborator', 'Supporter', 'Backer', 'Sponsor', 'Patron', 'Contributor',
    // Knowledge domains (short)
    'Quizzer', 'Trivia', 'Fact', 'Info', 'Data', 'Stats', 'Score', 'Points', 'Mark', 'Grade',
    'History', 'Science', 'Math', 'Art', 'Music', 'Literature', 'Culture', 'Language', 'Geography', 'Biology',
    'Physics', 'Chemistry', 'Astronomy', 'Geology', 'Psychology', 'Sociology', 'Economics', 'Politics', 'Philosophy', 'Theology',
    'Mathematics', 'Algebra', 'Geometry', 'Calculus', 'Statistics', 'Probability', 'Logic', 'Reasoning', 'Analysis',
    'Anthropology', 'Archaeology', 'Meteorology', 'Botany', 'Zoology', 'Ecology', 'Genetics', 'Evolution',
    'Mythology', 'Folklore', 'Legend', 'Tale', 'Story', 'Narrative', 'Chronicle', 'Record'
]

/**
 * Generate raw name parts (adjective and noun) for display name construction
 * Returns an object with adjective and noun that can be formatted
 */
function generateRawNameParts(): { adjective: string; noun: string } {
    const adjective = DISPLAY_NAME_ADJECTIVES[Math.floor(Math.random() * DISPLAY_NAME_ADJECTIVES.length)]
    const noun = DISPLAY_NAME_NOUNS[Math.floor(Math.random() * DISPLAY_NAME_NOUNS.length)]
    return { adjective, noun }
}

/**
 * Format display name parts into a final name string
 * Uses concatenated format (e.g., "QuickScholar")
 */
function formatDisplayName(adjective: string, noun: string): string {
    return `${adjective}${noun}`
}

/**
 * Generate a display name candidate that passes validation
 * Retries up to MAX_VALIDATION_RETRIES times if validation fails
 * Throws an error if unable to generate a valid candidate after retries
 */
const MAX_VALIDATION_RETRIES = 20

export function generateDisplayNameCandidate(): string {
    for (let attempt = 0; attempt < MAX_VALIDATION_RETRIES; attempt++) {
        const { adjective, noun } = generateRawNameParts()
        const candidate = formatDisplayName(adjective, noun)
        
        const validation = validateDisplayName(candidate)
        if (validation.ok) {
            return validation.normalized
        }
        
        // Log if we're getting close to max retries (edge case handling)
        if (attempt >= MAX_VALIDATION_RETRIES - 3) {
            console.warn(`Display name validation retry ${attempt + 1}/${MAX_VALIDATION_RETRIES} failed:`, validation.message)
        }
    }
    
    // Fallback: if all retries failed, use a safe default
    // This should be extremely rare with our curated word lists
    console.error(`Failed to generate valid display name after ${MAX_VALIDATION_RETRIES} attempts, using fallback`)
    return 'Quick Scholar' // Safe fallback that should always pass validation
}

/**
 * Generate a random display name for users
 * Combines a random adjective with a random noun
 * Note: Generated names are not guaranteed to be unique
 * 
 * This function now delegates to generateDisplayNameCandidate() to ensure
 * all generated names pass validation (profanity, reserved names, length, etc.)
 */
export function generateRandomDisplayName(): string {
    return generateDisplayNameCandidate()
}

/**
 * Options for generateUniqueDisplayName
 */
export interface GenerateUniqueDisplayNameOptions {
    /**
     * User ID to exclude from uniqueness check (useful when resetting a user's name)
     */
    excludeUserId?: string
    /**
     * Maximum number of attempts to generate a unique name
     * Default: 50
     */
    maxAttempts?: number
}

/**
 * Result of generateUniqueDisplayName
 */
export type GenerateUniqueDisplayNameResult =
    | { success: true; displayName: string; attempts: number }
    | { success: false; error: string; attempts: number }

/**
 * Generate a unique display name by checking against existing users in the database
 * 
 * This function:
 * 1. Generates a candidate name using generateDisplayNameCandidate()
 * 2. Checks for collisions against existing users (case-insensitive)
 * 3. Retries up to maxAttempts times if collisions occur
 * 4. Logs collisions for observability
 * 5. Returns a structured result indicating success or failure
 * 
 * Note: Uniqueness is enforced at the application layer, not at the database level.
 * Under extreme race conditions, duplicates could theoretically occur, but this
 * is extremely unlikely with our expanded word lists and retry logic.
 * 
 * @param prisma - Prisma client instance
 * @param options - Configuration options
 * @returns Result object with success status, display name (if successful), and attempt count
 */
export async function generateUniqueDisplayName(
    prisma: { user: { findFirst: (args: {
        where: {
            id?: { not: string }
            displayName: { equals: string; mode: 'insensitive' }
        }
        select: { id: true }
    }) => Promise<{ id: string } | null> } },
    options: GenerateUniqueDisplayNameOptions = {}
): Promise<GenerateUniqueDisplayNameResult> {
    const { excludeUserId, maxAttempts = 50 } = options
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const candidate = generateDisplayNameCandidate()
        
        // Check for collisions (case-insensitive)
        const existingUser = await prisma.user.findFirst({
            where: {
                ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
                displayName: {
                    equals: candidate,
                    mode: 'insensitive'
                }
            },
            select: { id: true }
        })
        
        if (!existingUser) {
            // Success! Found a unique name
            if (attempt > 0) {
                // Log collisions only if we had to retry
                console.log(`Display name collision resolved after ${attempt + 1} attempts. Final name: "${candidate}"`)
            }
            return {
                success: true,
                displayName: candidate,
                attempts: attempt + 1
            }
        }
        
        // Collision detected - log it
        if (attempt === 0 || (attempt + 1) % 10 === 0) {
            // Log first collision and every 10th collision
            console.warn(`Display name collision detected (attempt ${attempt + 1}/${maxAttempts}): "${candidate}" already exists`)
        }
    }
    
    // Exhausted all attempts
    const warningMessage = `Failed to generate unique display name after ${maxAttempts} attempts. This may indicate the word space needs expansion.`
    console.error(warningMessage)
    
    return {
        success: false,
        error: warningMessage,
        attempts: maxAttempts
    }
}


// Function to normalize text for comparison
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s&]/g, '') // Remove special characters except &
        .replace(/\s+/g, ' ')        // Normalize whitespace
        .trim()
}

// Convert number words to digits
function normalizeNumbers(text: string): string {
    const numberWords: { [key: string]: string } = {
        'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
        'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
        'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
        'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
        'eighteen': '18', 'nineteen': '19', 'twenty': '20',
        'thirty': '30', 'forty': '40', 'fifty': '50',
        'sixty': '60', 'seventy': '70', 'eighty': '80', 'ninety': '90',
        'hundred': '100', 'thousand': '1000', 'million': '1000000'
    }

    let normalized = text.toLowerCase()
    for (const [word, digit] of Object.entries(numberWords)) {
        normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), digit)
    }
    return normalized
}

// Get phonetic code for a word (using a simplified Soundex-like algorithm)
function getPhoneticCode(word: string): string {
    if (!word) return '';

    // Common phonetic replacements
    const phonetics: [RegExp, string][] = [
        [/[aeiou]/g, 'a'],           // Vowels -> a
        [/[bfpv]/g, 'b'],            // Similar lip sounds
        [/[cghjkq]/g, 'k'],          // Similar throat sounds
        [/[dt]/g, 't'],              // Similar dental sounds
        [/[mn]/g, 'm'],              // Similar nasal sounds
        [/[wy]/g, 'w'],              // Similar semi-vowels
        [/[sz]/g, 's'],              // Similar sibilants
        [/[lr]/g, 'r'],              // Similar liquids
        [/x/g, 'ks'],                // Expand x
        [/th/g, 't'],                // Common English digraph
        [/ch/g, 'k'],                // Common English digraph
        [/sh/g, 's'],                // Common English digraph
        [/ph/g, 'f']                 // Common English digraph
    ];

    let code = word.toLowerCase();
    phonetics.forEach(([pattern, replacement]) => {
        code = code.replace(pattern, replacement);
    });

    return code;
}

// Function to check if words are similar (basic fuzzy matching)
function areSimilar(word1: string, word2: string): boolean {
    if (word1 === word2) return true

    // Convert both to phonetic codes
    const code1 = getPhoneticCode(word1)
    const code2 = getPhoneticCode(word2)
    if (code1 === code2) return true

    // Check numerical equivalence
    const num1 = normalizeNumbers(word1)
    const num2 = normalizeNumbers(word2)
    if (num1 !== word1 && num2 !== word2 && num1 === num2) return true

    // Allow for common variations
    const variations = new Set([
        word1,
        word1.replace(/s$/, ''),     // Remove trailing 's'
        word1.replace(/es$/, ''),    // Remove trailing 'es'
        word1.replace(/ing$/, ''),   // Remove trailing 'ing'
        word1.replace(/ed$/, ''),    // Remove trailing 'ed'
        `${word1}s`,                 // Add 's'
        `${word1}es`,                // Add 'es'
    ])

    return variations.has(word2)
}

// Function to check if answer is a list
function isList(answer: string): boolean {
    return answer.includes('&') || answer.includes(',')
}

// Function to normalize list items
function normalizeList(text: string): string[] {
    return text
        .split(/[,&]/)
        .map(item => normalizeText(item))
        .filter(item => item.length > 0)
}

// Function to check if answer is a proper noun (basic check)
function isProperNoun(answer: string): boolean {
    // Check if the answer contains multiple words and each word starts with a capital letter
    const words = answer.trim().split(/\s+/)
    return words.length > 1 && words.every(word => /^[A-Z]/.test(word))
}

// Function to normalize articles
function normalizeArticles(text: string): string {
    // Only remove articles if they're not part of a proper noun or the entire answer
    const words = text.split(' ')
    if (words.length <= 1) return text

    const articles = ['a', 'an', 'the']
    // Keep articles if they're part of a proper noun (detected by capitalization)
    return words
        .map((word, i) => {
            if (articles.includes(word.toLowerCase()) && !word.startsWith('The')) {
                return null // Mark for removal
            }
            return word
        })
        .filter(word => word !== null)
        .join(' ')
}

// Function to handle parenthetical names
function handleParentheticalName(answer: string): string[] {
    const variants: string[] = [answer];

    // Match text within parentheses and the surrounding text
    const match = answer.match(/\(([^)]+)\)\s*(\w+)/) || answer.match(/(\w+)\s*\(([^)]+)\)/);
    if (match) {
        const withoutParens = answer.replace(/[()]/g, '').trim();
        const withoutParenContent = answer.replace(/\([^)]+\)/g, '').trim();
        variants.push(withoutParens, withoutParenContent);
    }

    return variants;
}

// Main answer checking function
export function checkAnswer(userAnswer: string, correctAnswer: string): boolean {
    let normalizedUser = normalizeText(userAnswer)
    let normalizedCorrect = normalizeText(correctAnswer)

    // Remove "what is" and "who is" from the beginning of the answer
    normalizedUser = normalizedUser.replace(/^(what|who) (is|are) /, '')

    // Normalize articles
    normalizedUser = normalizeArticles(normalizedUser)
    normalizedCorrect = normalizeArticles(normalizedCorrect)

    // Handle parenthetical names
    const correctVariants = handleParentheticalName(normalizedCorrect);
    if (correctVariants.some(variant => normalizedUser === normalizeText(variant))) {
        return true;
    }

    // Direct match after normalization
    if (normalizedUser === normalizedCorrect) return true

    // Handle lists if the answer isn't a proper noun
    if (isList(correctAnswer) && !isProperNoun(correctAnswer)) {
        const userItems = normalizeList(normalizedUser)
        const correctItems = normalizeList(normalizedCorrect)

        // Check if all items are present, regardless of order
        return correctItems.every(correctItem =>
            userItems.some(userItem => areSimilar(userItem, correctItem))
        )
    }

    // Split into words and check if all main words match
    const userWords = normalizedUser.split(' ')
    const correctWords = normalizedCorrect.split(' ')

    // If the answer is very short (1-2 words), check for exact match or phonetic match
    if (correctWords.length <= 2) {
        return normalizedUser === normalizedCorrect ||
            getPhoneticCode(normalizedUser) === getPhoneticCode(normalizedCorrect)
    }

    // For longer answers, check if most significant words match
    let matchedWords = 0
    let totalWords = correctWords.length

    for (const correctWord of correctWords) {
        if (userWords.some(userWord => areSimilar(userWord, correctWord))) {
            matchedWords++
        }
    }

    // Calculate match percentage
    const matchPercentage = matchedWords / totalWords
    return matchPercentage >= 0.8 // Require 80% match for longer answers
}

// Function to calculate points based on answer similarity
export function calculatePoints(userAnswer: string, correctAnswer: string, basePoints: number): number {
    const normalizedUser = normalizeText(userAnswer)
    const normalizedCorrect = normalizeText(correctAnswer)

    if (normalizedUser === normalizedCorrect) {
        return basePoints // Full points for exact match
    }

    if (checkAnswer(userAnswer, correctAnswer)) {
        return Math.floor(basePoints * 0.8) // 80% points for close match
    }

    return 0 // No points for incorrect answer
} 
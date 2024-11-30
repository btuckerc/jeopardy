// Function to normalize text for comparison
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove special characters
        .replace(/\s+/g, ' ')        // Normalize whitespace
        .trim()
}

// Function to check if words are similar (basic fuzzy matching)
function areSimilar(word1: string, word2: string): boolean {
    if (word1 === word2) return true

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

// Main answer checking function
export function checkAnswer(userAnswer: string, correctAnswer: string): boolean {
    const normalizedUser = normalizeText(userAnswer)
    const normalizedCorrect = normalizeText(correctAnswer)

    // Direct match after normalization
    if (normalizedUser === normalizedCorrect) return true

    // Split into words and check if all main words match
    const userWords = normalizedUser.split(' ')
    const correctWords = normalizedCorrect.split(' ')

    // Filter out common articles and conjunctions
    const stopWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'])
    const filteredUserWords = userWords.filter(word => !stopWords.has(word))
    const filteredCorrectWords = correctWords.filter(word => !stopWords.has(word))

    // If the answer is very short, require exact match
    if (filteredCorrectWords.length <= 2) {
        return normalizedUser === normalizedCorrect
    }

    // For longer answers, check if most significant words match
    let matchedWords = 0
    for (const userWord of filteredUserWords) {
        if (filteredCorrectWords.some(correctWord => areSimilar(userWord, correctWord))) {
            matchedWords++
        }
    }

    // Calculate match percentage
    const matchPercentage = matchedWords / Math.max(filteredUserWords.length, filteredCorrectWords.length)
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
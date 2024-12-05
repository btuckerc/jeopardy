// Add possessive pronouns and articles to be stripped
const REMOVABLE_WORDS = [
    // Possessive pronouns
    'my', 'your', 'his', 'her', 'their', 'our', 'its',
    // Articles
    'a', 'an', 'the'
];

// Function to normalize text for comparison
function normalizeText(text: string): string {
    let normalized = text
        .toLowerCase()
        .replace(/[^a-z0-9\s&]/g, '') // Remove special characters except &
        .replace(/\s+/g, ' ')        // Normalize whitespace
        .replace(/\s*&\s*/g, ' and ') // Replace & with 'and'
        .trim();

    // Remove possessive pronouns and articles from the start of the answer
    const words = normalized.split(' ');
    while (words.length > 1 && REMOVABLE_WORDS.includes(words[0])) {
        words.shift();
    }
    normalized = words.join(' ');

    return normalized;
}

// Known equivalent terms mapping
const EQUIVALENT_TERMS: { [key: string]: string[] } = {
    'hockey': ['ice hockey', 'hockey'],
    'football': ['american football', 'football'],
    'soccer': ['association football', 'soccer', 'football'],
    'first world war': ['world war 1', 'world war i', 'first world war', 'wwi', 'ww1'],
    'second world war': ['world war 2', 'world war ii', 'second world war', 'wwii', 'ww2'],
    'united states': ['united states of america', 'usa', 'us', 'united states'],
    'united kingdom': ['united kingdom', 'uk', 'great britain', 'britain']
}

// Function to check for equivalent terms
function checkEquivalentTerms(term1: string, term2: string): boolean {
    const normalizedTerm1 = normalizeText(term1)
    const normalizedTerm2 = normalizeText(term2)

    // Direct match
    if (normalizedTerm1 === normalizedTerm2) return true

    // Check equivalence groups
    for (const [_, equivalentGroup] of Object.entries(EQUIVALENT_TERMS)) {
        const normalizedGroup = equivalentGroup.map(t => normalizeText(t))
        if (normalizedGroup.includes(normalizedTerm1) && normalizedGroup.includes(normalizedTerm2)) {
            return true
        }
    }

    return false
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
    const variations1 = new Set([
        word1,
        word1.replace(/s$/, ''),     // Remove trailing 's'
        word1.replace(/es$/, ''),    // Remove trailing 'es'
        word1.replace(/ies$/, 'y'),  // Handle 'y' to 'ies' conversion
        word1.replace(/ing$/, ''),   // Remove trailing 'ing'
        word1.replace(/ed$/, ''),    // Remove trailing 'ed'
        `${word1}s`,                 // Add 's'
        `${word1}es`,                // Add 'es'
        word1.replace(/y$/, 'ies'),  // Handle 'y' to 'ies' conversion
    ])

    const variations2 = new Set([
        word2,
        word2.replace(/s$/, ''),
        word2.replace(/es$/, ''),
        word2.replace(/ies$/, 'y'),
        word2.replace(/ing$/, ''),
        word2.replace(/ed$/, ''),
        `${word2}s`,
        `${word2}es`,
        word2.replace(/y$/, 'ies'),
    ])

    // Check if any variation of word1 matches any variation of word2
    for (const v1 of variations1) {
        for (const v2 of variations2) {
            if (v1 === v2) return true
            // Also check phonetic similarity for variations
            if (getPhoneticCode(v1) === getPhoneticCode(v2)) return true
        }
    }

    return false
}

// Function to check if answer is a list
function isList(answer: string): boolean {
    return answer.includes('&') || answer.includes(',') || answer.toLowerCase().includes(' and ')
}

// Function to normalize list items
function normalizeList(text: string): string[] {
    return text
        .replace(/\s+and\s+/gi, ',') // Replace ' and ' with comma
        .replace(/\s*&\s*/g, ',')    // Replace & with comma
        .split(',')
        .map(item => normalizeText(item))
        .filter(item => item.length > 0)
}

// Function to check if answer is a proper noun (basic check)
function isProperNoun(answer: string): boolean {
    // Check if the answer contains multiple words and each word starts with a capital letter
    const words = answer.trim().split(/\s+/)
    return words.length > 1 && words.every(word => /^[A-Z]/.test(word))
}

// Function to normalize articles (can be removed since we handle it in normalizeText now)
function normalizeArticles(text: string): string {
    return text; // Just return the text as-is since we handle articles in normalizeText
}

// Function to handle parenthetical names
function handleParentheticalName(answer: string): string[] {
    const variants: string[] = [answer];

    // Handle "(or ...)" format
    const orMatch = answer.match(/(.*?)\s*\(or\s+(.*?)\)/i);
    if (orMatch) {
        variants.push(orMatch[1].trim(), orMatch[2].trim());
        return variants;
    }

    // Handle regular parenthetical content
    const match = answer.match(/^(.*?)\s*\((.*?)\)(?:\s*(.*))?$/);
    if (match) {
        const [_, beforeParens, inParens, afterParens] = match;
        const parts = [beforeParens, inParens, afterParens].filter(Boolean);

        // Add variants without parentheses
        variants.push(
            parts.join(' ').trim(),
            beforeParens.trim(),
            (beforeParens + ' ' + (afterParens || '')).trim()
        );

        // If there's content both before and after parentheses, try that combination
        if (beforeParens && afterParens) {
            variants.push((beforeParens + ' ' + afterParens).trim());
        }
    }

    return [...new Set(variants)].filter(Boolean);
}

// Main answer checking function
export function checkAnswer(userAnswer: string, correctAnswer: string): boolean {
    let normalizedUser = normalizeText(userAnswer)
    let normalizedCorrect = normalizeText(correctAnswer)

    // Check equivalent terms first
    if (checkEquivalentTerms(userAnswer, correctAnswer)) {
        return true
    }

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
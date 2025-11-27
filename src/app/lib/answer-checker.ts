// Add possessive pronouns and articles to be stripped
const REMOVABLE_WORDS = [
    // Possessive pronouns
    'my', 'your', 'his', 'her', 'their', 'our', 'its',
    // Articles
    'a', 'an', 'the'
];

// Function to normalize text for comparison
// Converts hyphens/dashes to spaces so "cray-cray" becomes "cray cray"
// Converts accented characters to their base form so "Bébé" becomes "bebe"
function normalizeText(text: string): string {
    let normalized = text
        .normalize('NFD')            // Decompose accented characters (é → e + combining accent)
        .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
        .toLowerCase()
        .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D-]/g, ' ') // Convert all dash/hyphen variants to spaces
        .replace(/[^a-z0-9\s&]/g, '') // Remove remaining special characters except &
        .replace(/\s+/g, ' ')        // Normalize whitespace (collapse multiple spaces)
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

// Compressed form: removes ALL spaces for ultimate equality comparison
// This makes "cray-cray", "cray cray", and "craycray" all equal
function compressText(text: string): string {
    return normalizeText(text).replace(/\s+/g, '');
}

// Phonetic normalization: converts common phonetic spellings to canonical form
// This allows "fone" to match "phone", "nite" to match "night", "baybay" to match "bébé", etc.
function phoneticNormalize(text: string): string {
    // First normalize accents
    let normalized = text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    
    // Common phonetic respellings (order matters - more specific first)
    const respellings: [RegExp, string][] = [
        // Vowel sound equivalences (é = ay = ey = ee)
        [/ay/g, 'e'],                // bay -> be, baybay -> bebe
        [/ey/g, 'e'],                // hey -> he
        [/ee/g, 'e'],                // bee -> be
        [/ea/g, 'e'],                // bead -> bed (simplified)
        
        // ph/f equivalence
        [/\bph/g, 'f'],              // phone -> fone
        [/ph\b/g, 'f'],              // graph -> graf
        [/ph/g, 'f'],                // phonetic -> fonetic
        
        // Silent letters and common reductions
        [/ght\b/g, 't'],             // night -> nit, light -> lit
        [/ght/g, 't'],               // fighter -> fiter
        [/kn\b/g, 'n'],              // knee -> nee
        [/\bkn/g, 'n'],              // know -> now
        [/wr\b/g, 'r'],              // write -> rite
        [/\bwr/g, 'r'],              
        [/mb\b/g, 'm'],              // lamb -> lam
        [/bt\b/g, 't'],              // debt -> det
        
        // Double letters
        [/([a-z])\1/g, '$1'],        // ll -> l, ss -> s, etc.
        
        // Common vowel sounds
        [/ough\b/g, 'o'],            // though -> tho
        [/ough/g, 'o'],              // thought -> thot (simplified)
        [/eigh/g, 'e'],              // weigh -> we
        [/aigh/g, 'e'],              // straight -> stret
    ];
    
    for (const [pattern, replacement] of respellings) {
        normalized = normalized.replace(pattern, replacement);
    }
    
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

// =============================================================================
// DOUBLE METAPHONE - Industry-standard phonetic algorithm
// Produces primary and secondary codes to handle words with multiple pronunciations
// Based on Lawrence Philips' algorithm
// =============================================================================
function doubleMetaphone(word: string): [string, string] {
    if (!word) return ['', ''];
    
    // Normalize: remove accents, lowercase
    let str = word
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
    
    let primary = '';
    let secondary = '';
    let index = 0;
    const length = str.length;
    const last = length - 1;
    
    // Pad the string for easier boundary checking
    str = '  ' + str + '     ';
    index += 2;
    
    const stringAt = (start: number, len: number, ...list: string[]): boolean => {
        const target = str.substring(start, start + len);
        return list.includes(target);
    };
    
    const isVowel = (pos: number): boolean => {
        return 'AEIOUY'.includes(str[pos]);
    };
    
    // Skip initial silent letters
    if (stringAt(index, 2, 'GN', 'KN', 'PN', 'WR', 'PS')) {
        index++;
    }
    
    // Initial X pronounced as S
    if (str[index] === 'X') {
        primary += 'S';
        secondary += 'S';
        index++;
    }
    
    while (index < length + 2 && (primary.length < 4 || secondary.length < 4)) {
        const char = str[index];
        
        switch (char) {
            case 'A': case 'E': case 'I': case 'O': case 'U': case 'Y':
                if (index === 2) { // Vowel at start
                    primary += 'A';
                    secondary += 'A';
                }
                index++;
                break;
                
            case 'B':
                primary += 'P';
                secondary += 'P';
                index += (str[index + 1] === 'B') ? 2 : 1;
                break;
                
            case 'C':
                if (stringAt(index, 2, 'CH')) {
                    primary += 'X';
                    secondary += 'X';
                    index += 2;
                } else if (stringAt(index, 2, 'CI', 'CE', 'CY')) {
                    primary += 'S';
                    secondary += 'S';
                    index += 1;
                } else {
                    primary += 'K';
                    secondary += 'K';
                    index += stringAt(index, 2, 'CK', 'CC', 'CQ') ? 2 : 1;
                }
                break;
                
            case 'D':
                if (stringAt(index, 2, 'DG')) {
                    if (stringAt(index + 2, 1, 'I', 'E', 'Y')) {
                        primary += 'J';
                        secondary += 'J';
                        index += 3;
                    } else {
                        primary += 'TK';
                        secondary += 'TK';
                        index += 2;
                    }
                } else {
                    primary += 'T';
                    secondary += 'T';
                    index += stringAt(index, 2, 'DT', 'DD') ? 2 : 1;
                }
                break;
                
            case 'F':
                primary += 'F';
                secondary += 'F';
                index += (str[index + 1] === 'F') ? 2 : 1;
                break;
                
            case 'G':
                if (str[index + 1] === 'H') {
                    if (index > 2 && !isVowel(index - 1)) {
                        index += 2;
                    } else if (index === 2) {
                        primary += 'K';
                        secondary += 'K';
                        index += 2;
                    } else {
                        index += 2;
                    }
                } else if (str[index + 1] === 'N') {
                    primary += 'N';
                    secondary += 'KN';
                    index += 2;
                } else if (stringAt(index + 1, 1, 'I', 'E', 'Y')) {
                    primary += 'J';
                    secondary += 'K';
                    index += 2;
                } else {
                    primary += 'K';
                    secondary += 'K';
                    index += (str[index + 1] === 'G') ? 2 : 1;
                }
                break;
                
            case 'H':
                if (isVowel(index + 1) && (index === 2 || isVowel(index - 1))) {
                    primary += 'H';
                    secondary += 'H';
                    index += 2;
                } else {
                    index++;
                }
                break;
                
            case 'J':
                primary += 'J';
                secondary += 'J';
                index += (str[index + 1] === 'J') ? 2 : 1;
                break;
                
            case 'K':
                primary += 'K';
                secondary += 'K';
                index += (str[index + 1] === 'K') ? 2 : 1;
                break;
                
            case 'L':
                primary += 'L';
                secondary += 'L';
                index += (str[index + 1] === 'L') ? 2 : 1;
                break;
                
            case 'M':
                primary += 'M';
                secondary += 'M';
                index += (str[index + 1] === 'M') ? 2 : 1;
                break;
                
            case 'N':
                primary += 'N';
                secondary += 'N';
                index += (str[index + 1] === 'N') ? 2 : 1;
                break;
                
            case 'P':
                if (str[index + 1] === 'H') {
                    primary += 'F';
                    secondary += 'F';
                    index += 2;
                } else {
                    primary += 'P';
                    secondary += 'P';
                    index += stringAt(index, 2, 'PP', 'PB') ? 2 : 1;
                }
                break;
                
            case 'Q':
                primary += 'K';
                secondary += 'K';
                index += (str[index + 1] === 'Q') ? 2 : 1;
                break;
                
            case 'R':
                primary += 'R';
                secondary += 'R';
                index += (str[index + 1] === 'R') ? 2 : 1;
                break;
                
            case 'S':
                if (stringAt(index, 2, 'SH')) {
                    primary += 'X';
                    secondary += 'X';
                    index += 2;
                } else if (stringAt(index, 3, 'SIO', 'SIA')) {
                    primary += 'X';
                    secondary += 'S';
                    index += 3;
                } else {
                    primary += 'S';
                    secondary += 'S';
                    index += stringAt(index, 2, 'SS', 'SC') ? 2 : 1;
                }
                break;
                
            case 'T':
                if (stringAt(index, 4, 'TION')) {
                    primary += 'X';
                    secondary += 'X';
                    index += 4;
                } else if (stringAt(index, 2, 'TH')) {
                    primary += '0'; // Using 0 for TH sound
                    secondary += 'T';
                    index += 2;
                } else {
                    primary += 'T';
                    secondary += 'T';
                    index += stringAt(index, 2, 'TT', 'TD') ? 2 : 1;
                }
                break;
                
            case 'V':
                primary += 'F';
                secondary += 'F';
                index += (str[index + 1] === 'V') ? 2 : 1;
                break;
                
            case 'W':
                if (str[index + 1] === 'R') {
                    primary += 'R';
                    secondary += 'R';
                    index += 2;
                } else if (isVowel(index + 1)) {
                    primary += 'A';
                    secondary += 'F';
                    index++;
                } else {
                    index++;
                }
                break;
                
            case 'X':
                primary += 'KS';
                secondary += 'KS';
                index += stringAt(index, 2, 'XX') ? 2 : 1;
                break;
                
            case 'Z':
                primary += 'S';
                secondary += 'S';
                index += (str[index + 1] === 'Z') ? 2 : 1;
                break;
                
            default:
                index++;
        }
    }
    
    return [primary.substring(0, 4), secondary.substring(0, 4)];
}

// Check if two words match phonetically using Double Metaphone
function phoneticMatch(word1: string, word2: string): boolean {
    const [primary1, secondary1] = doubleMetaphone(word1);
    const [primary2, secondary2] = doubleMetaphone(word2);
    
    // Match if any combination of primary/secondary codes match
    return Boolean(
        (primary1 && primary1 === primary2) ||
        (primary1 && primary1 === secondary2) ||
        (secondary1 && secondary1 === primary2) ||
        (secondary1 && secondary1 === secondary2)
    );
}

// =============================================================================
// JARO-WINKLER SIMILARITY - Better than Levenshtein for short strings
// Returns a score from 0 to 1 (1 = identical)
// Gives bonus for matching prefixes (common in typos)
// =============================================================================
function jaroWinkler(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    if (!s1.length || !s2.length) return 0;
    
    const len1 = s1.length;
    const len2 = s2.length;
    
    // Calculate match window
    const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
    
    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);
    
    let matches = 0;
    let transpositions = 0;
    
    // Find matches
    for (let i = 0; i < len1; i++) {
        const start = Math.max(0, i - matchWindow);
        const end = Math.min(i + matchWindow + 1, len2);
        
        for (let j = start; j < end; j++) {
            if (s2Matches[j] || s1[i] !== s2[j]) continue;
            s1Matches[i] = true;
            s2Matches[j] = true;
            matches++;
            break;
        }
    }
    
    if (matches === 0) return 0;
    
    // Count transpositions
    let k = 0;
    for (let i = 0; i < len1; i++) {
        if (!s1Matches[i]) continue;
        while (!s2Matches[k]) k++;
        if (s1[i] !== s2[k]) transpositions++;
        k++;
    }
    
    // Jaro similarity
    const jaro = (
        matches / len1 +
        matches / len2 +
        (matches - transpositions / 2) / matches
    ) / 3;
    
    // Winkler modification: boost for common prefix (up to 4 chars)
    let prefix = 0;
    for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
        if (s1[i] === s2[i]) prefix++;
        else break;
    }
    
    // Standard Winkler scaling factor is 0.1
    return jaro + (prefix * 0.1 * (1 - jaro));
}

// Get the phonetic "first sound" of a word for comparison
// This groups c/k, f/ph, g/j etc. as equivalent starting sounds
function getPhoneticFirstChar(word: string): string {
    if (!word) return '';
    const firstChar = word[0].toLowerCase();
    // Group phonetically equivalent first letters (consonants only)
    if ('ck'.includes(firstChar)) return 'k';
    if ('gj'.includes(firstChar)) return 'g';
    if ('fv'.includes(firstChar)) return 'f';
    if ('pb'.includes(firstChar)) return 'p';
    if ('td'.includes(firstChar)) return 't';
    if ('sz'.includes(firstChar)) return 's';
    if ('mn'.includes(firstChar)) return 'm';
    // DON'T group vowels - "iko" vs "oki" should have different first chars
    return firstChar;
}

// Check if two strings differ only by adjacent letter transposition
// e.g., "recieve" vs "receive" (ie vs ei), "teh" vs "the" (eh vs he)
// These are common typos and should be ALLOWED
function isTranspositionTypo(s1: string, s2: string): boolean {
    if (s1.length !== s2.length) return false;
    
    let differences = 0;
    let diffPositions: number[] = [];
    
    for (let i = 0; i < s1.length; i++) {
        if (s1[i] !== s2[i]) {
            differences++;
            diffPositions.push(i);
            if (differences > 2) return false; // More than 2 differences = not a transposition
        }
    }
    
    // Exactly 2 adjacent differences where letters are swapped
    if (differences === 2 && diffPositions[1] - diffPositions[0] === 1) {
        const i = diffPositions[0];
        return s1[i] === s2[i + 1] && s1[i + 1] === s2[i];
    }
    
    return false;
}

// Check if two strings are anagrams (same letters, different order)
// Anagrams should NOT be accepted as matches, EXCEPT for transposition typos
function isProblematicAnagram(s1: string, s2: string): boolean {
    if (s1 === s2) return false; // Same string is not an anagram
    if (s1.length !== s2.length) return false; // Different lengths can't be anagrams
    
    // Sort letters and compare
    const sorted1 = s1.split('').sort().join('');
    const sorted2 = s2.split('').sort().join('');
    
    if (sorted1 !== sorted2) return false; // Not an anagram
    
    // It's an anagram - but is it just a transposition typo?
    // Transposition typos (adjacent letters swapped) are OK
    if (isTranspositionTypo(s1, s2)) return false;
    
    // It's a problematic anagram (letters significantly rearranged)
    return true;
}

// =============================================================================
// WORD SIMILARITY - Phonetic-primary approach with safeguards
// =============================================================================
function areSimilar(word1: string, word2: string): boolean {
    if (word1 === word2) return true;
    
    // CRITICAL: Reject anagrams - same letters in different order are NOT the same word
    // "iko" vs "oki", "dog" vs "god", "tac" vs "cat" should NOT match
    if (isProblematicAnagram(word1, word2)) {
        return false;
    }
    
    const minLen = Math.min(word1.length, word2.length);
    const maxLen = Math.max(word1.length, word2.length);
    const similarity = jaroWinkler(word1, word2);
    
    // Check both literal and phonetic first character match
    const literalFirstCharMatches = word1[0].toLowerCase() === word2[0].toLowerCase();
    const phoneticFirstCharMatches = getPhoneticFirstChar(word1) === getPhoneticFirstChar(word2);
    
    // STRICT: Very short words (≤3 chars) - require literal first char match
    if (minLen <= 3) {
        if (!literalFirstCharMatches) return false;
        return phoneticMatch(word1, word2) && similarity >= 0.85;
    }
    
    // SHORT WORDS (4-5 chars): Allow phonetic first-char match for phonetic equivalents
    if (maxLen <= 5) {
        if (phoneticMatch(word1, word2) && phoneticFirstCharMatches) {
            return similarity >= 0.85;
        }
        // Very high similarity can also pass (catches "abby"/"abbey" = 0.95)
        return similarity >= 0.92 && literalFirstCharMatches;
    }
    
    // MEDIUM WORDS (6-8 chars): Phonetic primary with phonetic first-char check
    if (maxLen <= 8) {
        if (phoneticMatch(word1, word2) && phoneticFirstCharMatches) {
            return similarity >= 0.80;
        }
        return similarity >= 0.88 && literalFirstCharMatches;
    }
    
    // LONGER WORDS (9+ chars): More lenient
    if (phoneticMatch(word1, word2) && phoneticFirstCharMatches) {
        return true;
    }
    if (similarity >= 0.85 && literalFirstCharMatches) {
        return true;
    }
    
    // Check numerical equivalence
    const num1 = normalizeNumbers(word1);
    const num2 = normalizeNumbers(word2);
    if (num1 !== word1 && num2 !== word2 && num1 === num2) return true;

    // Allow for common grammatical variations
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
    ]);

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
    ]);

    // Check if any variation matches exactly or phonetically
    for (const v1 of variations1) {
        for (const v2 of variations2) {
            if (v1 === v2) return true;
            if (phoneticMatch(v1, v2)) return true;
        }
    }

    return false;
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

// Helper to strip "what is", "who is", etc. from user answer
function stripQuestionPhrase(text: string): string {
    return text.replace(/^(what|who|where|when) (is|are|was|were) /, '')
}

// Main answer checking function
export function checkAnswer(userAnswer: string, correctAnswer: string): boolean {
    let normalizedUser = normalizeText(userAnswer)
    let normalizedCorrect = normalizeText(correctAnswer)

    // Remove "what is", "who is", etc. from the beginning of the user's answer
    normalizedUser = stripQuestionPhrase(normalizedUser)

    // Compressed forms for ultimate comparison (strips all spaces)
    // This makes "cray-cray", "cray cray", and "craycray" all equal
    const compressedUser = compressText(userAnswer).replace(/^(whatis|whois|whereis|whenis|whatare|whoare|whereare|whenare|whatwas|whowas|wherewas|whenwas|whatwere|whowere|wherewere|whenwere)/, '')
    const compressedCorrect = compressText(correctAnswer)

    // Early exit: compressed forms match exactly
    if (compressedUser === compressedCorrect) {
        return true
    }

    // Check phonetic normalizations (handles "fone"/"phone", "nite"/"night", etc.)
    const phoneticUser = phoneticNormalize(compressedUser)
    const phoneticCorrect = phoneticNormalize(compressedCorrect)
    if (phoneticUser === phoneticCorrect) {
        return true
    }

    // Check equivalent terms
    if (checkEquivalentTerms(userAnswer, correctAnswer)) {
        return true
    }

    // Handle parenthetical names BEFORE normalization strips the parentheses
    // This handles answers like "Abraham Lincoln (or Honest Abe)"
    const correctVariants = handleParentheticalName(correctAnswer);
    for (const variant of correctVariants) {
        const normalizedVariant = normalizeText(variant)
        if (normalizedUser === normalizedVariant) {
            return true
        }
        // Also check compressed form of variant
        if (compressedUser === compressText(variant)) {
            return true
        }
    }

    // Normalize articles
    normalizedUser = normalizeArticles(normalizedUser)
    normalizedCorrect = normalizeArticles(normalizedCorrect)

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

    // If the answer is very short (1-2 words), use phonetic-primary matching with safeguards
    if (correctWords.length <= 2) {
        // CRITICAL: Reject anagrams early
        if (isProblematicAnagram(compressedUser, compressedCorrect)) {
            return false
        }
        
        const compressedSimilarity = jaroWinkler(compressedUser, compressedCorrect)
        
        // Check both literal and phonetic first character match
        const literalFirstCharMatches = compressedUser[0] === compressedCorrect[0]
        const phoneticFirstCharMatches = getPhoneticFirstChar(compressedUser) === getPhoneticFirstChar(compressedCorrect)
        
        // Check phonetic match on compressed form with phonetic first-char match
        if (phoneticMatch(compressedUser, compressedCorrect) && phoneticFirstCharMatches) {
            if (compressedSimilarity >= 0.85) return true
        }
        
        // Word-by-word similarity check - all words must be similar
        if (userWords.length === correctWords.length) {
            const allWordsSimilar = correctWords.every((correctWord, i) => 
                areSimilar(userWords[i], correctWord)
            )
            if (allWordsSimilar) return true
        }

        // For different word counts, check if compressed forms are very similar
        // using Jaro-Winkler (catches "westminsterabby" vs "westminsterabbey")
        // Require literal first char match to prevent anagrams
        if (compressedSimilarity >= 0.92 && literalFirstCharMatches) {
            return true
        }

        return false
    }

    // For longer answers, check if most significant words match
    let matchedWords = 0
    const totalWords = correctWords.length

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
    // Strip question phrases from user answer for comparison
    const cleanedUser = stripQuestionPhrase(normalizeText(userAnswer))
    const normalizedCorrect = normalizeText(correctAnswer)

    // Full points for exact normalized match
    if (cleanedUser === normalizedCorrect) {
        return basePoints
    }

    // Full points for compressed match (handles hyphen/space variants)
    const compressedUser = compressText(userAnswer).replace(/^(whatis|whois|whereis|whenis|whatare|whoare|whereare|whenare|whatwas|whowas|wherewas|whenwas|whatwere|whowere|wherewere|whenwere)/, '')
    const compressedCorrect = compressText(correctAnswer)
    if (compressedUser === compressedCorrect) {
        return basePoints
    }

    // For close matches (phonetic, fuzzy), award full points since checkAnswer already
    // applies appropriate leniency thresholds
    if (checkAnswer(userAnswer, correctAnswer)) {
        return basePoints
    }

    return 0 // No points for incorrect answer
} 
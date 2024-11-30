// Common stock symbols and their company names
const stockSymbols = new Map([
    ['AAPL', 'Apple'],
    ['MSFT', 'Microsoft'],
    ['GOOGL', 'Google'],
    ['AMZN', 'Amazon'],
    ['META', 'Meta'],
    ['NFLX', 'Netflix'],
    ['TSLA', 'Tesla'],
    // Add more as needed
])

// Common abbreviations and their expansions
const abbreviations = new Map([
    ['NYC', 'New York City'],
    ['USA', 'United States of America'],
    ['UK', 'United Kingdom'],
    ['UN', 'United Nations'],
    ['NASA', 'National Aeronautics and Space Administration'],
    ['FBI', 'Federal Bureau of Investigation'],
    ['CIA', 'Central Intelligence Agency'],
    // Add more as needed
])

// Extract potential keywords from the question
function extractKeywords(question: string): string[] {
    // Remove common words and punctuation
    const stopWords = new Set(['what', 'who', 'where', 'when', 'why', 'how', 'is', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'])
    return question
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => !stopWords.has(word))
}

// Get suggestions based on input and context
export function getSuggestions(input: string, question: string, answer: string): string[] {
    if (!input.trim()) return []

    const inputLower = input.toLowerCase()
    const suggestions = new Set<string>()

    // Add stock symbols and company names
    for (const [symbol, company] of stockSymbols) {
        if (symbol.toLowerCase().startsWith(inputLower) || company.toLowerCase().startsWith(inputLower)) {
            suggestions.add(symbol)
            suggestions.add(company)
        }
    }

    // Add abbreviations and their expansions
    for (const [abbr, expansion] of abbreviations) {
        if (abbr.toLowerCase().startsWith(inputLower) || expansion.toLowerCase().startsWith(inputLower)) {
            suggestions.add(abbr)
            suggestions.add(expansion)
        }
    }

    // Add keywords from the question that match
    const keywords = extractKeywords(question)
    for (const keyword of keywords) {
        if (keyword.startsWith(inputLower)) {
            suggestions.add(keyword)
        }
    }

    // Add the correct answer if it starts with the input
    // (but only if it's a single word to avoid giving away multi-word answers)
    if (!answer.includes(' ') && answer.toLowerCase().startsWith(inputLower)) {
        suggestions.add(answer)
    }

    // Convert to array, sort, and limit results
    return Array.from(suggestions)
        .sort((a, b) => {
            // Prioritize exact matches
            const aStartsExact = a.toLowerCase().startsWith(inputLower)
            const bStartsExact = b.toLowerCase().startsWith(inputLower)
            if (aStartsExact && !bStartsExact) return -1
            if (!aStartsExact && bStartsExact) return 1

            // Then sort by length (shorter first)
            return a.length - b.length
        })
        .slice(0, 5) // Limit to 5 suggestions
}

// Function to check if we should show suggestions
export function shouldShowSuggestions(input: string): boolean {
    return input.length >= 2 // Only show suggestions after 2 characters
} 
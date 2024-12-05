export function checkAnswer(userAnswer: string, correctAnswer: string): boolean {
    // Normalize both answers to remove accents and convert to lowercase
    const normalizeText = (text: string) => {
        return text
            .normalize('NFD')                // Decompose characters into base + diacritical marks
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
            .toLowerCase()                   // Convert to lowercase
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ')           // Normalize whitespace
            .trim()                         // Remove leading/trailing whitespace
    }

    const normalizedUserAnswer = normalizeText(userAnswer)
    const normalizedCorrectAnswer = normalizeText(correctAnswer)

    // Remove optional "what is" or "who is" from the beginning
    const cleanAnswer = (answer: string) => {
        return answer
            .replace(/^(what|who) (is|are|was|were) /i, '')
            .replace(/^(the|a|an) /i, '')
    }

    const cleanedUserAnswer = cleanAnswer(normalizedUserAnswer)
    const cleanedCorrectAnswer = cleanAnswer(normalizedCorrectAnswer)

    // Check for exact match first
    if (cleanedUserAnswer === cleanedCorrectAnswer) {
        return true
    }

    // Check for close matches (e.g., minor typos)
    const levenshteinDistance = (a: string, b: string): number => {
        if (a.length === 0) return b.length
        if (b.length === 0) return a.length

        const matrix = []

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i]
        }

        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1]
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    )
                }
            }
        }

        return matrix[b.length][a.length]
    }

    // Allow for small typos based on answer length
    const maxAllowedDistance = Math.floor(cleanedCorrectAnswer.length * 0.2) // 20% of answer length
    const distance = levenshteinDistance(cleanedUserAnswer, cleanedCorrectAnswer)

    return distance <= maxAllowedDistance
} 
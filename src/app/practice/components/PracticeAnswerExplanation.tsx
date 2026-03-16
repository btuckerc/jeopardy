export type AnswerExplanation = {
    title: string
    summary: string
    tips: string[]
}

const QUESTION_PREFIX = /^(?:what|who|where|when|why|how|which)\s+(?:is|are|was|were|did|do|does|can|could|should|would|will|has|have)\b/i

function normalizeText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[`'"“”‘’]/g, '')
        .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function stripQuestionPhrase(value: string): string {
    const normalized = normalizeText(value)
    return normalized.replace(QUESTION_PREFIX, '').trim()
}

function extractVariants(value: string): string[] {
    const variants = new Set<string>()

    const normalized = normalizeText(value)
    const stripped = stripQuestionPhrase(value)

    variants.add(normalized)
    variants.add(stripped)

    const trailing = normalized.match(/^(.+?)\s*\((.+?)\)\s*$/)
    if (trailing) {
        variants.add(trailing[1].trim())
        variants.add(trailing[2].trim())
    }

    const leading = normalized.match(/^\((.+?)\)\s+(.+)$/)
    if (leading) {
        variants.add(leading[2].trim())
        variants.add(`${leading[1].trim()} ${leading[2].trim()}`)
    }

    const mid = normalized.match(/^(.+?)\s*\((.+?)\)\s*(.+)$/)
    if (mid && !trailing && !leading) {
        variants.add(`${mid[1].trim()} ${mid[3].trim()}`)
        variants.add(`${mid[1].trim()} ${mid[2].trim()} ${mid[3].trim()}`)
    }

    return Array.from(variants).filter(Boolean)
}

function splitTokens(value: string): string[] {
    return value
        .trim()
        .split(/\s+/)
        .map(token => token.trim())
        .filter(Boolean)
}

function levenshtein(a: string, b: string): number {
    if (a.length === 0) return b.length
    if (b.length === 0) return a.length

    const matrix = Array.from({ length: b.length + 1 }, (_, row) =>
        Array.from({ length: a.length + 1 }, (_, col) => (row === 0 ? col : col === 0 ? row : 0))
    )

    for (let row = 1; row <= b.length; row += 1) {
        for (let col = 1; col <= a.length; col += 1) {
            if (a[col - 1] === b[row - 1]) {
                matrix[row][col] = matrix[row - 1][col - 1]
            } else {
                matrix[row][col] = Math.min(
                    matrix[row - 1][col] + 1,
                    matrix[row][col - 1] + 1,
                    matrix[row - 1][col - 1] + 1
                )
            }
        }
    }

    return matrix[b.length][a.length]
}

function buildFeedbackFromVariant(userText: string, correctText: string) {
    const userTokens = splitTokens(userText)
    const correctTokens = splitTokens(correctText)

    if (userTokens.length === 0 || correctTokens.length === 0) {
        return null
    }

    const correctSet = new Set(correctTokens)
    const userSet = new Set(userTokens)

    const missingTokens = correctTokens.filter(token => !userSet.has(token))
    const extraTokens = userTokens.filter(token => !correctSet.has(token))
    const sharedCount = correctTokens.filter(token => userSet.has(token)).length

    const overlapRatio = sharedCount / correctTokens.length
    const precision = sharedCount / userTokens.length

    const distance = levenshtein(userText, correctText)
    const maxLength = Math.max(userText.length, correctText.length)
    const typoPenalty = maxLength > 0 ? distance / maxLength : 1

    const closenessScore = (overlapRatio * 0.5) + (precision * 0.3) + ((1 - typoPenalty) * 0.2)
    const qualityPenalty = (missingTokens.length / correctTokens.length) * 0.3 + (extraTokens.length / Math.max(1, userTokens.length)) * 0.2

    const score = closenessScore - qualityPenalty
    const tips: string[] = []

    if (missingTokens.length > 0 && missingTokens.length <= 2 && overlapRatio >= 0.5) {
        tips.push(`You may be missing: ${missingTokens.join(', ')}`)
    }

    if (extraTokens.length > 0 && extraTokens.length <= 3 && precision >= 0.55) {
        tips.push('Try a shorter answer with just the core noun phrase.')
    }

    if (extraTokens.length > 0 && precision < 0.45) {
        tips.push('Your response is broad; remove filler words and restate the core target.')
    }

    if (distance <= 3 && distance > 0 && maxLength >= 4) {
        tips.push('Watch for small typos or letter transpositions.')
    }

    if (overlapRatio >= 0.85 && precision >= 0.75) {
        return {
            title: 'Very close',
            summary: 'Strong match. Format or spacing is likely the only issue.',
            tips: tips.length > 0
                ? tips
                : ['Try matching punctuation/style variants like abbreviations or honorifics exactly as presented.'],
            score: Math.max(0, score + 0.25),
        }
    }

    if (extraTokens.length > 0 && userTokens.length > correctTokens.length) {
        return {
            title: 'Too broad',
            summary: 'You included details that do not match the expected answer.',
            tips: tips.length > 0
                ? tips
                : ['Answer with the specific person/place/thing only.'],
            score: Math.max(0, score),
        }
    }

    if (overlapRatio >= 0.45 && precision >= 0.45) {
        return {
            title: 'Partial match',
            summary: 'You recognized some of the required wording, but one key element is off.',
            tips: tips.length > 0
                ? tips
                : ['Focus on the key subject and one important qualifier.'],
            score: Math.max(0, score),
        }
    }

    if (overlapRatio >= 0.25) {
        return {
            title: 'Close attempt',
            summary: 'Your answer is close but missing critical wording.',
            tips: ['Try answering with a precise noun phrase and the key qualifier.', 'Reduce articles and extra context.'],
            score: Math.max(0, score),
        }
    }

    return {
        title: 'Review required',
        summary: 'This response does not align with expected answer patterns yet.',
        tips: [
            'Use the core subject/target from the clue only.',
            'Avoid long explanations; Jeopardy answers are usually concise.',
        ],
        score: Math.max(0, score),
    }
}

export function buildAnswerExplanation(userAnswer: string, correctAnswer: string): AnswerExplanation | null {
    const trimmedUser = userAnswer.trim()
    const trimmedCorrect = correctAnswer.trim()

    if (!trimmedUser || !trimmedCorrect) {
        return null
    }

    const normalizedUser = stripQuestionPhrase(trimmedUser)
    const variants = extractVariants(trimmedCorrect)

    let bestFeedback: (AnswerExplanation & { score: number }) | null = null

    for (const variant of variants) {
        const normalizedCorrect = normalizeText(variant)
        const feedback = buildFeedbackFromVariant(normalizedUser, normalizedCorrect)

        if (!feedback) continue

        if (!bestFeedback || feedback.score > bestFeedback.score) {
            bestFeedback = feedback
        }
    }

    if (!bestFeedback) {
        return {
            title: 'Review needed',
            summary: 'Your answer did not match this clue yet.',
            tips: [
                'Try again with a shorter, exact noun phrase.',
                'Avoid extra clues unless specifically requested.',
            ],
        }
    }

    return {
        title: bestFeedback.title,
        summary: bestFeedback.summary,
        tips: bestFeedback.tips,
    }
}

export function AnswerExplanationPanel({
    userAnswer,
    correctAnswer,
    explanationMode,
    visible,
}: {
    userAnswer: string
    correctAnswer: string
    explanationMode: boolean
    visible: boolean
}) {
    if (!explanationMode || !visible || !userAnswer.trim() || !correctAnswer.trim()) {
        return null
    }

    const explanation = buildAnswerExplanation(userAnswer, correctAnswer)

    if (!explanation) {
        return null
    }

    return (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4" role="note" aria-live="polite">
            <p className="text-sm font-semibold text-blue-900 mb-1">{explanation.title}</p>
            <p className="text-sm text-blue-800">{explanation.summary}</p>
            <ul className="mt-2 space-y-1">
                {explanation.tips.map(tip => (
                    <li key={tip} className="text-xs text-blue-700 leading-5">• {tip}</li>
                ))}
            </ul>
        </div>
    )
}

import type { AnswerMatchReason } from './answer-checker'

export interface DisputeDerivedRegression {
    label: string
    correctAnswer: string
    userAnswer: string
    expectedReason: Extract<AnswerMatchReason, 'common_noun_plural' | 'punctuation_title_normalization'>
}

// Curated from approved disputes and adjudicated edge cases.
// Add new entries here whenever a dispute is approved so it stays covered by tests.
export const DISPUTE_DERIVED_REGRESSIONS: DisputeDerivedRegression[] = [
    {
        label: 'science common noun singular for plural',
        correctAnswer: 'clouds',
        userAnswer: 'cloud',
        expectedReason: 'common_noun_plural'
    }
]

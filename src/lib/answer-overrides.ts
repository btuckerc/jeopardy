import { prisma } from '@/lib/prisma'
import { checkAnswer, normalizeAnswerText } from '@/app/lib/answer-checker'

export interface AnswerOverride {
  id: string
  questionId: string
  text: string
  createdByUserId: string
  source: 'ADMIN' | 'DISPUTE'
  notes?: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Fetch all answer overrides for a given question
 */
export async function getQuestionOverrides(questionId: string): Promise<AnswerOverride[]> {
  const overrides = await prisma.answerOverride.findMany({
    where: { questionId },
    orderBy: { createdAt: 'asc' }
  })
  
  return overrides.map(override => ({
    id: override.id,
    questionId: override.questionId,
    text: override.text,
    createdByUserId: override.createdByUserId,
    source: override.source as 'ADMIN' | 'DISPUTE',
    notes: override.notes,
    createdAt: override.createdAt,
    updatedAt: override.updatedAt
  }))
}

/**
 * Check if a user answer matches the canonical answer or any override
 */
export function isAnswerAcceptedWithOverrides(
  userAnswer: string,
  canonicalAnswer: string,
  overrides: AnswerOverride[]
): boolean {
  return checkAnswer(userAnswer, canonicalAnswer)
    || overrides.some((override) => checkAnswer(userAnswer, override.text))
}

/**
 * Normalize an answer string for storage as an override
 * Uses the same normalization logic as checkAnswer
 */
export function normalizeAnswerForOverride(answer: string): string {
  return normalizeAnswerText(answer)
}

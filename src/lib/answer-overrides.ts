import { prisma } from '@/lib/prisma'
import { checkAnswer } from '@/app/lib/answer-checker'

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
  // First check against canonical answer
  if (checkAnswer(userAnswer, canonicalAnswer)) {
    return true
  }
  
  // Then check against all overrides
  for (const override of overrides) {
    if (checkAnswer(userAnswer, override.text)) {
      return true
    }
  }
  
  return false
}

/**
 * Normalize an answer string for storage as an override
 * Uses the same normalization logic as checkAnswer
 */
export function normalizeAnswerForOverride(answer: string): string {
  // Use the same normalization that checkAnswer uses internally
  // This ensures consistency between checking and storage
  return answer
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D-]/g, ' ')
    .replace(/[^a-z0-9\s&]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*&\s*/g, ' and ')
    .trim()
}


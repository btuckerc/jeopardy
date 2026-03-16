import { prisma } from '@/lib/prisma'
import {
  checkAnswerDetailed,
  checkAnswerDetailedAsync,
  normalizeAnswerText,
  type AnswerMatchReason,
  type AnswerMatchResult
} from '@/app/lib/answer-checker'

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

export interface OverrideAwareAnswerMatchResult extends AnswerMatchResult {
  overrideId?: string
  overrideText?: string
}

function toDirectMatchReason(reason: AnswerMatchReason): OverrideAwareAnswerMatchResult['matchReason'] {
  if (reason === 'override' || reason === 'manual_override' || reason === 'no_match') {
    return undefined
  }

  return reason
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
  return evaluateAnswerWithOverrides(userAnswer, canonicalAnswer, overrides).accepted
}

/**
 * Async variant for server-side grading paths that can use semantic matching.
 */
export async function isAnswerAcceptedWithOverridesAsync(
  userAnswer: string,
  canonicalAnswer: string,
  overrides: AnswerOverride[]
): Promise<boolean> {
  return (await evaluateAnswerWithOverridesAsync(userAnswer, canonicalAnswer, overrides)).accepted
}

export function evaluateAnswerWithOverrides(
  userAnswer: string,
  canonicalAnswer: string,
  overrides: AnswerOverride[]
): OverrideAwareAnswerMatchResult {
  const canonicalResult = checkAnswerDetailed(userAnswer, canonicalAnswer)
  if (canonicalResult.accepted) {
    return canonicalResult
  }

  for (const override of overrides) {
    const overrideResult = checkAnswerDetailed(userAnswer, override.text)
    if (overrideResult.accepted) {
      return {
        accepted: true,
        reason: 'manual_override',
        matchedAnswer: override.text,
        matchReason: toDirectMatchReason(overrideResult.reason),
        similarity: overrideResult.similarity,
        overrideId: override.id,
        overrideText: override.text,
        overrideSource: override.source
      }
    }
  }

  return canonicalResult
}

export async function evaluateAnswerWithOverridesAsync(
  userAnswer: string,
  canonicalAnswer: string,
  overrides: AnswerOverride[]
): Promise<OverrideAwareAnswerMatchResult> {
  const canonicalResult = await checkAnswerDetailedAsync(userAnswer, canonicalAnswer)
  if (canonicalResult.accepted) {
    return canonicalResult
  }

  for (const override of overrides) {
    const overrideResult = await checkAnswerDetailedAsync(userAnswer, override.text)
    if (overrideResult.accepted) {
      return {
        accepted: true,
        reason: 'manual_override',
        matchedAnswer: override.text,
        matchReason: toDirectMatchReason(overrideResult.reason),
        similarity: overrideResult.similarity,
        overrideId: override.id,
        overrideText: override.text,
        overrideSource: override.source
      }
    }
  }

  return canonicalResult
}

/**
 * Normalize an answer string for storage as an override
 * Uses the same normalization logic as checkAnswer
 */
export function normalizeAnswerForOverride(answer: string): string {
  return normalizeAnswerText(answer)
}

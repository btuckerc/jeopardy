/**
 * Centralized Question Content-Source Visibility & Backwards-Compatibility Policy
 *
 * All public gameplay, study, search, shuffle, friend challenge, and daily challenge
 * queries MUST go through this module so licensed LEGACY_JEOPARDY rows never leak
 * into new user gameplay while preserving existing user history, stats, and
 * in-progress legacy game completion (and explicit ADMIN legacy inspection).
 */

import { Prisma, QuestionPublishStatus, QuestionSource } from '@prisma/client'

export type LegacyInProgressPolicy = 'ALLOW_FINISH' | 'RETIRE'

export interface BoardSnapshot {
    SINGLE?: string[]
    DOUBLE?: string[]
    FINAL?: string
}

/**
 * Default source for all new games, practice sessions, and daily challenges.
 */
export const DEFAULT_PLAYABLE_SOURCE: QuestionSource = QuestionSource.ORIGINAL_ENGINE

/**
 * J-Archive scraping is disabled by default in production.
 * Must be explicitly opted in via ENABLE_JARCHIVE_SYNC=true.
 */
export function isJArchiveSyncEnabled(): boolean {
    return process.env.ENABLE_JARCHIVE_SYNC === 'true'
}

/**
 * Assert that J-Archive scraping is explicitly enabled before making outbound requests.
 */
export function assertJArchiveSyncEnabled(context: string): void {
    if (!isJArchiveSyncEnabled()) {
        throw new Error(
            `J-Archive scraping is disabled (${context}). Set ENABLE_JARCHIVE_SYNC=true only for explicit legacy admin operations.`
        )
    }
}

/**
 * Controls whether pre-cutover IN_PROGRESS legacy games can finish on their
 * snapshotted legacy board ('ALLOW_FINISH', default) or must be gracefully retired ('RETIRE').
 */
export function getLegacyInProgressPolicy(): LegacyInProgressPolicy {
    return process.env.LEGACY_IN_PROGRESS_POLICY === 'RETIRE' ? 'RETIRE' : 'ALLOW_FINISH'
}

/**
 * Prisma where-clause fragment enforcing content source & publish status.
 */
export function getPlayableQuestionWhere(
    source: QuestionSource = DEFAULT_PLAYABLE_SOURCE
): Prisma.QuestionWhereInput {
    return {
        source,
        publishStatus: QuestionPublishStatus.PUBLISHED,
    }
}

/**
 * Prisma where-clause fragment for Category queries scoped to a source.
 */
export function getPlayableCategoryWhere(
    source: QuestionSource = DEFAULT_PLAYABLE_SOURCE
): Prisma.CategoryWhereInput {
    return {
        source,
    }
}

/**
 * Raw SQL fragment matching getPlayableQuestionWhere for prisma.$queryRaw queries.
 * Table alias MUST be a safe static identifier like 'q'.
 */
export function getPlayableQuestionSql(
    alias: string = 'q',
    source: QuestionSource = DEFAULT_PLAYABLE_SOURCE
): Prisma.Sql {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(alias)) {
        throw new Error(`Invalid SQL table alias: ${alias}`)
    }
    const rawAlias = Prisma.raw(alias)
    return Prisma.sql`${rawAlias}."source" = ${source}::"QuestionSource" AND ${rawAlias}."publishStatus" = 'PUBLISHED'::"QuestionPublishStatus"`
}

/**
 * TV episode spoiler-cutoff filtering only applies to aired LEGACY_JEOPARDY episodes.
 * Original generated packs use airDate as their pack release date and are NOT TV spoilers.
 */
export function shouldApplySpoilerFilter(source: QuestionSource): boolean {
    return source === QuestionSource.LEGACY_JEOPARDY
}

/**
 * Resolve requested source parameter, restricting LEGACY_JEOPARDY strictly to admins.
 */
export function resolveRequestedContentSource(
    requestedSource: string | null | undefined,
    isAdmin: boolean
): QuestionSource {
    if (requestedSource === QuestionSource.LEGACY_JEOPARDY && isAdmin) {
        return QuestionSource.LEGACY_JEOPARDY
    }
    return DEFAULT_PLAYABLE_SOURCE
}

/**
 * Determine whether a game with the given contentSource is allowed to continue playing.
 */
export function canPlayGameContentSource(
    contentSource: QuestionSource,
    status: string,
    isAdmin: boolean
): { allowed: boolean; retired: boolean } {
    if (contentSource === QuestionSource.ORIGINAL_ENGINE) {
        return { allowed: true, retired: false }
    }
    if (isAdmin) {
        return { allowed: true, retired: false }
    }
    if (status === 'COMPLETED') {
        // Completed legacy games remain reviewable by their owner
        return { allowed: true, retired: false }
    }
    if (getLegacyInProgressPolicy() === 'RETIRE') {
        return { allowed: false, retired: true }
    }
    return { allowed: true, retired: false }
}

/**
 * Safely parse boardSnapshot from Game.config JSON.
 */
export function parseBoardSnapshot(config: unknown): BoardSnapshot {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return {}
    }
    const typed = config as Record<string, unknown>
    const raw = typed.boardSnapshot
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {}
    }
    const snap = raw as Record<string, unknown>
    const result: BoardSnapshot = {}
    if (Array.isArray(snap.SINGLE)) {
        result.SINGLE = snap.SINGLE.filter((id): id is string => typeof id === 'string')
    }
    if (Array.isArray(snap.DOUBLE)) {
        result.DOUBLE = snap.DOUBLE.filter((id): id is string => typeof id === 'string')
    }
    if (typeof snap.FINAL === 'string') {
        result.FINAL = snap.FINAL
    }
    return result
}

/**
 * Return a new config JSON object with updated boardSnapshot for a round.
 */
export function mergeBoardSnapshotIntoConfig(
    config: unknown,
    patch: Partial<BoardSnapshot>
): Prisma.InputJsonValue {
    const base =
        config && typeof config === 'object' && !Array.isArray(config)
            ? ({ ...(config as Record<string, unknown>) })
            : {}
    const existing = parseBoardSnapshot(base)
    return {
        ...base,
        boardSnapshot: {
            ...existing,
            ...patch,
        },
    } as unknown as Prisma.InputJsonValue
}

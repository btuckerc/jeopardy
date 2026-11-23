import { describe, expect, it, afterEach } from 'vitest'
import {
    assertJArchiveSyncEnabled,
    canPlayGameContentSource,
    getPlayableQuestionWhere,
    isJArchiveSyncEnabled,
    mergeBoardSnapshotIntoConfig,
    parseBoardSnapshot,
    resolveRequestedContentSource,
    shouldApplySpoilerFilter,
} from './question-policy'

describe('question-policy', () => {
    const origJArchive = process.env.ENABLE_JARCHIVE_SYNC
    const origLegacyPolicy = process.env.LEGACY_IN_PROGRESS_POLICY

    afterEach(() => {
        if (origJArchive === undefined) delete process.env.ENABLE_JARCHIVE_SYNC
        else process.env.ENABLE_JARCHIVE_SYNC = origJArchive
        if (origLegacyPolicy === undefined) delete process.env.LEGACY_IN_PROGRESS_POLICY
        else process.env.LEGACY_IN_PROGRESS_POLICY = origLegacyPolicy
    })

    it('disables J-Archive sync by default and throws when asserted', () => {
        delete process.env.ENABLE_JARCHIVE_SYNC
        expect(isJArchiveSyncEnabled()).toBe(false)
        expect(() => assertJArchiveSyncEnabled('test')).toThrow(/disabled/)

        process.env.ENABLE_JARCHIVE_SYNC = 'true'
        expect(isJArchiveSyncEnabled()).toBe(true)
        expect(() => assertJArchiveSyncEnabled('test')).not.toThrow()
    })

    it('defaults playable queries to ORIGINAL_ENGINE + PUBLISHED and restricts LEGACY_JEOPARDY to admins', () => {
        expect(getPlayableQuestionWhere()).toEqual({
            source: 'ORIGINAL_ENGINE',
            publishStatus: 'PUBLISHED',
        })
        expect(resolveRequestedContentSource('LEGACY_JEOPARDY', false)).toBe('ORIGINAL_ENGINE')
        expect(resolveRequestedContentSource('LEGACY_JEOPARDY', true)).toBe('LEGACY_JEOPARDY')
        expect(shouldApplySpoilerFilter('ORIGINAL_ENGINE')).toBe(false)
        expect(shouldApplySpoilerFilter('LEGACY_JEOPARDY')).toBe(true)
    })

    it('supports ALLOW_FINISH and RETIRE policies for in-progress legacy games while preserving completed reviews', () => {
        delete process.env.LEGACY_IN_PROGRESS_POLICY
        expect(canPlayGameContentSource('LEGACY_JEOPARDY', 'IN_PROGRESS', false)).toEqual({
            allowed: true,
            retired: false,
        })

        process.env.LEGACY_IN_PROGRESS_POLICY = 'RETIRE'
        expect(canPlayGameContentSource('LEGACY_JEOPARDY', 'IN_PROGRESS', false)).toEqual({
            allowed: false,
            retired: true,
        })
        // Completed legacy games stay reviewable; admins stay allowed
        expect(canPlayGameContentSource('LEGACY_JEOPARDY', 'COMPLETED', false)).toEqual({
            allowed: true,
            retired: false,
        })
        expect(canPlayGameContentSource('LEGACY_JEOPARDY', 'IN_PROGRESS', true)).toEqual({
            allowed: true,
            retired: false,
        })
    })

    it('parses and merges boardSnapshot without clobbering existing config fields', () => {
        const merged = mergeBoardSnapshotIntoConfig(
            { mode: 'random', rounds: { single: true, double: true, final: true } },
            { SINGLE: ['q1', 'q2'] }
        ) as Record<string, unknown>
        expect(merged.mode).toBe('random')
        expect(parseBoardSnapshot(merged)).toEqual({ SINGLE: ['q1', 'q2'] })

        const merged2 = mergeBoardSnapshotIntoConfig(merged, { FINAL: 'q99' })
        expect(parseBoardSnapshot(merged2)).toEqual({
            SINGLE: ['q1', 'q2'],
            FINAL: 'q99',
        })
    })
})

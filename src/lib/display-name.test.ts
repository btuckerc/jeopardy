import { describe, expect, it } from 'vitest'

import { isCustomDisplayName, isSystemGeneratedDisplayName, normalizeDisplayName } from './display-name'

describe('display-name origin helpers', () => {
    it('detects generated display names from the built-in pool', () => {
        expect(isSystemGeneratedDisplayName('QuickScholar')).toBe(true)
        expect(isCustomDisplayName('QuickScholar')).toBe(false)
    })

    it('treats user-authored names as custom', () => {
        expect(isSystemGeneratedDisplayName('Trivia Titan')).toBe(false)
        expect(isCustomDisplayName('Trivia Titan')).toBe(true)
    })

    it('normalizes spacing before checking generated names', () => {
        expect(isSystemGeneratedDisplayName(`  ${normalizeDisplayName('QuickScholar')}  `)).toBe(true)
    })

    it('does not treat empty names as custom or generated', () => {
        expect(isSystemGeneratedDisplayName(null)).toBe(false)
        expect(isSystemGeneratedDisplayName('')).toBe(false)
        expect(isCustomDisplayName(undefined)).toBe(false)
    })
})

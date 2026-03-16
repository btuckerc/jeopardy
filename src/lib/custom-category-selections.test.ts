import { describe, expect, it } from 'vitest'
import {
    getCustomCategorySelectionKey,
    parseCustomCategorySelections,
    serializeCustomCategorySelections,
} from './custom-category-selections'

describe('custom category selections helpers', () => {
    it('serializes and parses ordered board variants', () => {
        const value = serializeCustomCategorySelections([
            { categoryId: 'cat-1', airDate: '2024-01-15', round: 'SINGLE' },
            { categoryId: 'cat-2', airDate: '2023-05-10', round: 'DOUBLE' },
        ])

        expect(parseCustomCategorySelections(value)).toEqual([
            { categoryId: 'cat-1', airDate: '2024-01-15', round: 'SINGLE' },
            { categoryId: 'cat-2', airDate: '2023-05-10', round: 'DOUBLE' },
        ])
    })

    it('drops duplicate or invalid selections', () => {
        const parsed = parseCustomCategorySelections(JSON.stringify([
            { categoryId: 'cat-1', airDate: '2024-01-15', round: 'SINGLE' },
            { categoryId: 'cat-1', airDate: '2024-01-15', round: 'SINGLE' },
            { categoryId: 'cat-2', airDate: 'bad-date', round: 'SINGLE' },
        ]))

        expect(parsed).toEqual([
            { categoryId: 'cat-1', airDate: '2024-01-15', round: 'SINGLE' },
        ])
    })

    it('builds stable selection keys', () => {
        expect(getCustomCategorySelectionKey({
            categoryId: 'cat-1',
            airDate: '2024-01-15',
            round: 'SINGLE',
        })).toBe('cat-1:SINGLE:2024-01-15')
    })
})

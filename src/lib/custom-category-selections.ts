export type CustomCategorySelectionRound = 'SINGLE' | 'DOUBLE'

export interface CustomCategorySelection {
    categoryId: string
    airDate: string
    round: CustomCategorySelectionRound
}

function isCustomCategorySelection(value: unknown): value is CustomCategorySelection {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }

    const typed = value as Record<string, unknown>
    return typeof typed.categoryId === 'string'
        && typeof typed.airDate === 'string'
        && /^\d{4}-\d{2}-\d{2}$/.test(typed.airDate)
        && (typed.round === 'SINGLE' || typed.round === 'DOUBLE')
}

export function getCustomCategorySelectionKey(selection: CustomCategorySelection): string {
    return `${selection.categoryId}:${selection.round}:${selection.airDate}`
}

export function normalizeCustomCategorySelections(
    selections: CustomCategorySelection[],
): CustomCategorySelection[] {
    const seen = new Set<string>()

    return selections.filter((selection) => {
        const key = getCustomCategorySelectionKey(selection)
        if (seen.has(key)) {
            return false
        }

        seen.add(key)
        return true
    })
}

export function serializeCustomCategorySelections(
    selections: CustomCategorySelection[],
): string {
    return JSON.stringify(normalizeCustomCategorySelections(selections))
}

export function parseCustomCategorySelections(
    value: string | null | undefined,
): CustomCategorySelection[] {
    if (!value) {
        return []
    }

    try {
        const parsed = JSON.parse(value) as unknown
        if (!Array.isArray(parsed)) {
            return []
        }

        return normalizeCustomCategorySelections(parsed.filter(isCustomCategorySelection))
    } catch {
        return []
    }
}

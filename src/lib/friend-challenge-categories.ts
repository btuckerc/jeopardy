export const FRIEND_CHALLENGE_MIN_CATEGORY_COUNT = 1
export const FRIEND_CHALLENGE_MAX_CATEGORY_COUNT = 6
export const FRIEND_CHALLENGE_MIN_SELECTED_QUESTION_COUNT = 5

export type FriendChallengeCategorySelection = 'RANDOM' | 'CUSTOM'

export function normalizeFriendChallengeCategorySelection(
    value: string | null | undefined,
): FriendChallengeCategorySelection {
    const normalized = value?.trim().toUpperCase()
    return normalized === 'CUSTOM' || normalized === 'CHOSEN'
        ? 'CUSTOM'
        : 'RANDOM'
}

export function clampFriendChallengeCategoryCount(
    value: number | null | undefined,
    fallback: number = FRIEND_CHALLENGE_MIN_CATEGORY_COUNT,
): number {
    const candidate = Number.isFinite(value) ? Math.trunc(value as number) : fallback
    return Math.min(
        Math.max(candidate, FRIEND_CHALLENGE_MIN_CATEGORY_COUNT),
        FRIEND_CHALLENGE_MAX_CATEGORY_COUNT,
    )
}

export function getFriendChallengeSelectionProgress(
    selectedCount: number,
    categoryCount: number,
) {
    const boundedSelected = Math.max(0, Math.trunc(selectedCount))
    const boundedCategoryCount = clampFriendChallengeCategoryCount(categoryCount)
    const remainingCount = Math.max(boundedCategoryCount - boundedSelected, 0)

    return {
        selectedCount: Math.min(boundedSelected, boundedCategoryCount),
        categoryCount: boundedCategoryCount,
        remainingCount,
        isComplete: remainingCount === 0,
        willAutoFill: boundedSelected > 0 && remainingCount > 0,
    }
}

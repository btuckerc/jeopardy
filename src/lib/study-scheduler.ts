export type ReviewPriority = 'HIGH' | 'MEDIUM' | 'LOW'

export interface CategoryStudySnapshot {
    categoryId: string
    categoryName: string
    totalQuestions: number
    correctAnswers: number
    lastAttemptedAt: Date | null
    knowledgeCategoryId: string | null
}

export interface CategoryStudyRecommendation extends CategoryStudySnapshot {
    accuracy: number
    reviewIntervalDays: number
    dueInDays: number
    isDue: boolean
    priority: ReviewPriority
    reason: string
    actionLabel: 'Rebuild' | 'Refresh' | 'Maintain'
    daysSinceReview: number | null
    recommendedQuestionCount: number
}

export interface QuickSessionItem {
    categoryId: string
    categoryName: string
    knowledgeCategoryId: string | null
    priority: ReviewPriority
    actionLabel: CategoryStudyRecommendation['actionLabel']
    recommendedQuestionCount: number
}

export interface MixedReviewSuggestion {
    knowledgeCategoryId: string
    categoryIds: string[]
    categoryCount: number
}

export interface StudyRecommendationProfile {
    recommendations: CategoryStudyRecommendation[]
    quickSession: {
        categories: string[]
        items: QuickSessionItem[]
        summary: string
        totalTargetQuestions: number
        mixedReview: MixedReviewSuggestion | null
    }
    focusNow: CategoryStudyRecommendation | null
    totalAttemptedCategories: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_RECOMMENDATION_COUNT = 5

function clampAccuracy(accuracy: number): number {
    if (Number.isNaN(accuracy) || !Number.isFinite(accuracy)) return 0
    return Math.max(0, Math.min(100, accuracy))
}

function priorityScore(priority: ReviewPriority): number {
    return priority === 'HIGH' ? 3 : priority === 'MEDIUM' ? 2 : 1
}

function getActionLabel(accuracy: number, isDue: boolean): CategoryStudyRecommendation['actionLabel'] {
    if (accuracy < 40) return 'Rebuild'
    if (isDue || accuracy < 75) return 'Refresh'
    return 'Maintain'
}

function getRecommendedQuestionCount(totalQuestions: number, accuracy: number, isDue: boolean): number {
    const desiredCount = accuracy < 40
        ? 8
        : accuracy < 65 || isDue
            ? 6
            : 4

    if (totalQuestions > 0) {
        return Math.max(1, Math.min(totalQuestions, desiredCount))
    }

    return desiredCount
}

export function getReviewIntervalDays(accuracy: number): number {
    const rounded = clampAccuracy(accuracy)

    if (rounded >= 85) return 14
    if (rounded >= 70) return 7
    if (rounded >= 50) return 4
    if (rounded >= 30) return 2

    return 1
}

export function getRecommendationPriority(accuracy: number, dueInDays: number): ReviewPriority {
    const rounded = clampAccuracy(accuracy)

    if (rounded < 35) {
        return 'HIGH'
    }

    if (dueInDays <= 0 && rounded < 65) {
        return 'HIGH'
    }

    if (rounded < 65) {
        return 'MEDIUM'
    }

    if (dueInDays <= 0) {
        return 'MEDIUM'
    }

    return 'LOW'
}

export function buildStudyRecommendations(
    categories: CategoryStudySnapshot[],
    options: {
        now?: Date
        maxRecommendations?: number
        maxSessionSize?: number
    } = {}
): StudyRecommendationProfile {
    const now = options.now ?? new Date()
    const maxRecommendations = Math.max(
        1,
        Math.min(options.maxRecommendations ?? MAX_RECOMMENDATION_COUNT, MAX_RECOMMENDATION_COUNT)
    )

    const maxSessionSize = Math.max(1, options.maxSessionSize ?? 3)

    const recommendations: CategoryStudyRecommendation[] = categories
        .map(category => {
            const accuracy = category.totalQuestions > 0
                ? (category.correctAnswers / category.totalQuestions) * 100
                : 0

            const reviewIntervalDays = getReviewIntervalDays(accuracy)
            const elapsedDays = category.lastAttemptedAt
                ? (now.getTime() - category.lastAttemptedAt.getTime()) / DAY_MS
                : Number.POSITIVE_INFINITY
            const daysUntilReview = category.lastAttemptedAt
                ? Math.max(0, Math.ceil(reviewIntervalDays - elapsedDays))
                : 0
            const isDue = !category.lastAttemptedAt || elapsedDays >= reviewIntervalDays
            const priority = getRecommendationPriority(accuracy, daysUntilReview)
            const daysSinceReview = Number.isFinite(elapsedDays) ? Math.max(0, Math.floor(elapsedDays)) : null
            const actionLabel = getActionLabel(accuracy, isDue)

            const reason = isDue
                ? accuracy >= 70
                    ? `Keep your streak strong with quick review.`
                    : `Review now to improve retention in this category.`
                : `Review again in ${daysUntilReview} day${daysUntilReview === 1 ? '' : 's'}.`

            return {
                ...category,
                accuracy: clampAccuracy(accuracy),
                reviewIntervalDays,
                dueInDays: daysUntilReview,
                isDue,
                priority,
                reason,
                actionLabel,
                daysSinceReview,
                recommendedQuestionCount: getRecommendedQuestionCount(category.totalQuestions, accuracy, isDue),
            }
        })
        .sort((a, b) => {
            if (a.isDue !== b.isDue) {
                return a.isDue ? -1 : 1
            }

            const priorityDiff = priorityScore(b.priority) - priorityScore(a.priority)
            if (priorityDiff !== 0) {
                return priorityDiff
            }

            if (a.accuracy !== b.accuracy) {
                return a.accuracy - b.accuracy
            }

            return a.dueInDays - b.dueInDays
        })
        .slice(0, maxRecommendations)

    const focusNow = recommendations.find(rec => rec.isDue) || recommendations[0] || null
    const sessionItems = recommendations.slice(0, maxSessionSize).map(item => ({
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        knowledgeCategoryId: item.knowledgeCategoryId,
        priority: item.priority,
        actionLabel: item.actionLabel,
        recommendedQuestionCount: item.recommendedQuestionCount
    }))
    const dueCount = sessionItems.filter(item =>
        recommendations.find(rec => rec.categoryId === item.categoryId)?.isDue
    ).length
    const totalTargetQuestions = sessionItems.reduce((sum, item) => sum + item.recommendedQuestionCount, 0)

    const mixedReviewBuckets = sessionItems.reduce<Map<string, string[]>>((bucketMap, item) => {
        if (!item.knowledgeCategoryId) return bucketMap
        const bucket = bucketMap.get(item.knowledgeCategoryId) || []
        bucket.push(item.categoryId)
        bucketMap.set(item.knowledgeCategoryId, bucket)
        return bucketMap
    }, new Map())

    const mixedReviewEntry = [...mixedReviewBuckets.entries()]
        .sort((a, b) => b[1].length - a[1].length)[0]

    const mixedReview = mixedReviewEntry && mixedReviewEntry[1].length > 1
        ? {
            knowledgeCategoryId: mixedReviewEntry[0],
            categoryIds: mixedReviewEntry[1],
            categoryCount: mixedReviewEntry[1].length
        }
        : null

    return {
        recommendations,
        quickSession: {
            categories: sessionItems.map(item => item.categoryId),
            items: sessionItems,
            summary: `${sessionItems.length} ${sessionItems.length === 1 ? 'category' : 'categories'} · about ${totalTargetQuestions} clues · ${dueCount} due now`,
            totalTargetQuestions,
            mixedReview
        },
        focusNow,
        totalAttemptedCategories: categories.length,
    }
}

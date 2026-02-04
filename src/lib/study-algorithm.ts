import { prisma } from '@/lib/prisma'

interface CategoryPerformance {
    categoryId: string
    categoryName: string
    totalQuestions: number
    correctAnswers: number
    accuracy: number
    lastAttemptedAt: Date | null
}

/**
 * Get categories sorted by performance (weakest first)
 * This helps users focus on areas where they need the most improvement
 */
export async function getCategoriesByWeakestFirst(userId: string): Promise<CategoryPerformance[]> {
    // Get all user progress grouped by category
    const progressData = await prisma.userProgress.findMany({
        where: { userId },
        include: {
            question: {
                include: {
                    category: true
                }
            }
        }
    })

    // Group by category
    const categoryMap = new Map<string, {
        categoryId: string
        categoryName: string
        total: number
        correct: number
        lastAttempted: Date | null
    }>()

    for (const progress of progressData) {
        const categoryId = progress.question.category.id
        const categoryName = progress.question.category.name
        
        if (!categoryMap.has(categoryId)) {
            categoryMap.set(categoryId, {
                categoryId,
                categoryName,
                total: 0,
                correct: 0,
                lastAttempted: null
            })
        }
        
        const data = categoryMap.get(categoryId)!
        data.total += progress.total
        data.correct += progress.correct
    }

    // Convert to array and calculate accuracy
    const performances: CategoryPerformance[] = Array.from(categoryMap.values()).map(data => ({
        categoryId: data.categoryId,
        categoryName: data.categoryName,
        totalQuestions: data.total,
        correctAnswers: data.correct,
        accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
        lastAttemptedAt: data.lastAttempted
    }))

    // Sort by: accuracy (ascending), then by last attempted (most recent first for ties)
    performances.sort((a, b) => {
        if (a.accuracy !== b.accuracy) {
            return a.accuracy - b.accuracy
        }
        // For ties, put most recently attempted first
        if (a.lastAttemptedAt && b.lastAttemptedAt) {
            return b.lastAttemptedAt.getTime() - a.lastAttemptedAt.getTime()
        }
        if (a.lastAttemptedAt) return -1
        if (b.lastAttemptedAt) return 1
        return 0
    })

    return performances
}

/**
 * Get the weakest category for a user
 * Returns null if user has no progress data
 */
export async function getWeakestCategory(userId: string): Promise<CategoryPerformance | null> {
    const performances = await getCategoriesByWeakestFirst(userId)
    return performances.length > 0 ? performances[0] : null
}

/**
 * Get recommended study categories
 * Returns top 3 weakest categories, or all if less than 3
 */
export async function getRecommendedStudyCategories(userId: string): Promise<CategoryPerformance[]> {
    const performances = await getCategoriesByWeakestFirst(userId)
    
    // If user has no progress, return empty array
    if (performances.length === 0) {
        return []
    }
    
    // Return top 3 weakest, or all if less than 3
    return performances.slice(0, 3)
}

/**
 * Get study recommendation message
 */
export async function getStudyRecommendation(userId: string): Promise<{
    message: string
    categoryId: string | null
    categoryName: string | null
}> {
    const weakestCategory = await getWeakestCategory(userId)
    
    if (!weakestCategory) {
        return {
            message: "Start practicing to get personalized recommendations!",
            categoryId: null,
            categoryName: null
        }
    }
    
    const accuracy = Math.round(weakestCategory.accuracy)
    
    if (accuracy < 30) {
        return {
            message: `Focus on ${weakestCategory.categoryName} - you're at ${accuracy}% accuracy`,
            categoryId: weakestCategory.categoryId,
            categoryName: weakestCategory.categoryName
        }
    } else if (accuracy < 60) {
        return {
            message: `${weakestCategory.categoryName} needs work - currently at ${accuracy}%`,
            categoryId: weakestCategory.categoryId,
            categoryName: weakestCategory.categoryName
        }
    } else {
        return {
            message: `Keep improving ${weakestCategory.categoryName} - at ${accuracy}% accuracy`,
            categoryId: weakestCategory.categoryId,
            categoryName: weakestCategory.categoryName
        }
    }
}

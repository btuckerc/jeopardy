import { jsonResponse, serverErrorResponse, requireAdmin } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/content-metrics
 * Get content quality metrics: question coverage, category distribution, issues, etc.
 */
export async function GET(_request: Request) {
    try {
        const { error: authError } = await requireAdmin()
        if (authError) return authError

        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        // Run all queries in parallel
        const [
            totalQuestions,
            questionsByRound,
            questionsByKnowledgeCategory,
            questionsWithAirDate,
            questionsWithoutAirDate,
            tripleStumperCount,
            categoryCount,
            categoriesByKnowledge,
            dailyChallengeStats,
            hotQuestions,
            recentDisputes,
            recentIssues,
            airDateRange,
        ] = await Promise.all([
            // Total questions
            prisma.question.count(),

            // Questions by round
            prisma.question.groupBy({
                by: ['round'],
                _count: { id: true },
            }),

            // Questions by knowledge category
            prisma.question.groupBy({
                by: ['knowledgeCategory'],
                _count: { id: true },
            }),

            // Questions with air date
            prisma.question.count({
                where: { airDate: { not: null } },
            }),

            // Questions without air date
            prisma.question.count({
                where: { airDate: null },
            }),

            // Triple stumper count
            prisma.question.count({
                where: { wasTripleStumper: true },
            }),

            // Total categories
            prisma.category.count(),

            // Categories by knowledge category
            prisma.category.groupBy({
                by: ['knowledgeCategory'],
                _count: { id: true },
            }),

            // Daily challenge stats
            prisma.dailyChallenge.aggregate({
                _count: { id: true },
            }),

            // "Hot" questions - most disputed/reported in last 30 days
            prisma.question.findMany({
                where: {
                    OR: [
                        { disputes: { some: { createdAt: { gte: thirtyDaysAgo } } } },
                        { issueReports: { some: { createdAt: { gte: thirtyDaysAgo } } } },
                    ],
                },
                select: {
                    id: true,
                    question: true,
                    answer: true,
                    value: true,
                    round: true,
                    category: { select: { name: true } },
                    _count: {
                        select: {
                            disputes: true,
                            issueReports: true,
                        },
                    },
                },
                orderBy: {
                    disputes: { _count: 'desc' },
                },
                take: 20,
            }),

            // Recent disputes by question
            prisma.answerDispute.groupBy({
                by: ['questionId'],
                where: { createdAt: { gte: thirtyDaysAgo } },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 10,
            }),

            // Recent issues by question
            prisma.issueReport.groupBy({
                by: ['questionId'],
                where: {
                    createdAt: { gte: thirtyDaysAgo },
                    questionId: { not: null },
                },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 10,
            }),

            // Air date range
            prisma.question.aggregate({
                where: { airDate: { not: null } },
                _min: { airDate: true },
                _max: { airDate: true },
            }),
        ])

        // Calculate coverage (how many days have questions)
        const airDateCoverage = await calculateAirDateCoverage()

        // Get season distribution
        const seasonDistribution = await prisma.question.groupBy({
            by: ['season'],
            where: { season: { not: null } },
            _count: { id: true },
            orderBy: { season: 'desc' },
        })

        // Get difficulty distribution
        const difficultyDistribution = await prisma.question.groupBy({
            by: ['difficulty'],
            _count: { id: true },
        })

        // Format hot questions
        const formattedHotQuestions = hotQuestions
            .map(q => ({
                id: q.id,
                question: q.question.slice(0, 100) + (q.question.length > 100 ? '...' : ''),
                answer: q.answer,
                value: q.value,
                round: q.round,
                category: q.category.name,
                disputeCount: q._count.disputes,
                issueCount: q._count.issueReports,
                totalIssues: q._count.disputes + q._count.issueReports,
            }))
            .sort((a, b) => b.totalIssues - a.totalIssues)

        return jsonResponse({
            overview: {
                totalQuestions,
                totalCategories: categoryCount,
                questionsWithAirDate,
                questionsWithoutAirDate,
                tripleStumperCount,
                tripleStumperRate: totalQuestions > 0 
                    ? (tripleStumperCount / totalQuestions) * 100 
                    : 0,
                dailyChallengesGenerated: dailyChallengeStats._count.id,
            },
            distribution: {
                byRound: questionsByRound.map(r => ({
                    round: r.round,
                    count: r._count.id,
                })),
                byKnowledgeCategory: questionsByKnowledgeCategory.map(k => ({
                    category: k.knowledgeCategory,
                    count: k._count.id,
                })),
                byDifficulty: difficultyDistribution.map(d => ({
                    difficulty: d.difficulty,
                    count: d._count.id,
                })),
                bySeason: seasonDistribution
                    .filter(s => s.season !== null)
                    .slice(0, 10)
                    .map(s => ({
                        season: s.season,
                        count: s._count.id,
                    })),
                categoriesByKnowledge: categoriesByKnowledge.map(c => ({
                    knowledgeCategory: c.knowledgeCategory || 'UNCATEGORIZED',
                    count: c._count.id,
                })),
            },
            coverage: {
                airDateRange: {
                    earliest: airDateRange._min.airDate?.toISOString() || null,
                    latest: airDateRange._max.airDate?.toISOString() || null,
                },
                ...airDateCoverage,
            },
            hotQuestions: formattedHotQuestions,
            recentActivity: {
                disputedQuestionIds: recentDisputes.map(d => ({
                    questionId: d.questionId,
                    count: d._count.id,
                })),
                reportedQuestionIds: recentIssues
                    .filter(i => i.questionId)
                    .map(i => ({
                        questionId: i.questionId,
                        count: i._count.id,
                    })),
            },
            timestamp: now.toISOString(),
        })
    } catch (error) {
        return serverErrorResponse('Error fetching content metrics', error)
    }
}

/**
 * Calculate air date coverage statistics
 */
async function calculateAirDateCoverage() {
    try {
        // Get all distinct air dates
        const dates = await prisma.question.findMany({
            where: { airDate: { not: null } },
            select: { airDate: true },
            distinct: ['airDate'],
        })

        const dateSet = new Set(
            dates
                .map(d => d.airDate?.toISOString().split('T')[0])
                .filter(Boolean)
        )

        // Get range
        const sortedDates = Array.from(dateSet).sort()
        const firstDateStr = sortedDates[0]
        const lastDateStr = sortedDates[sortedDates.length - 1]
        
        if (!firstDateStr || !lastDateStr) {
            return {
                daysWithData: 0,
                totalDaysInRange: 0,
                coveragePercent: 0,
            }
        }

        const firstDate = new Date(firstDateStr)
        const lastDate = new Date(lastDateStr)
        
        // Calculate total days in range
        const totalDaysInRange = Math.ceil(
            (lastDate.getTime() - firstDate.getTime()) / (24 * 60 * 60 * 1000)
        ) + 1

        return {
            daysWithData: dateSet.size,
            totalDaysInRange,
            coveragePercent: totalDaysInRange > 0 
                ? (dateSet.size / totalDaysInRange) * 100 
                : 0,
        }
    } catch {
        return {
            daysWithData: 0,
            totalDaysInRange: 0,
            coveragePercent: 0,
        }
    }
}


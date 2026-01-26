import { jsonResponse, serverErrorResponse, requireAdmin, parseSearchParams } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const abuseMetricsParamsSchema = z.object({
    window: z.enum(['7d', '30d', '90d']).optional().default('30d'),
})

/**
 * GET /api/admin/abuse-metrics
 * Get disputes and issues pipeline metrics, trends, and aging analysis
 */
export async function GET(request: Request) {
    try {
        const { error: authError } = await requireAdmin()
        if (authError) return authError

        const { searchParams } = new URL(request.url)
        const { data: params, error } = parseSearchParams(searchParams, abuseMetricsParamsSchema)
        if (error) return error

        const { window } = params
        const now = new Date()
        
        // Calculate time range
        let startTime: Date
        const bucketMs = 24 * 60 * 60 * 1000 // Daily buckets
        
        switch (window) {
            case '7d':
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                break
            case '90d':
                startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
                break
            case '30d':
            default:
                startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                break
        }

        // Fetch all data in parallel
        const [
            // Disputes
            allDisputes,
            disputesByStatus,
            disputesByMode,
            disputesByRound,
            pendingDisputes,
            
            // Issues
            allIssues,
            issuesByStatus,
            issuesByCategory,
            openIssues,
        ] = await Promise.all([
            // All disputes in window
            prisma.answerDispute.findMany({
                where: { createdAt: { gte: startTime } },
                select: {
                    id: true,
                    status: true,
                    mode: true,
                    round: true,
                    createdAt: true,
                    resolvedAt: true,
                },
                orderBy: { createdAt: 'asc' },
            }),

            // Disputes by status (all time)
            prisma.answerDispute.groupBy({
                by: ['status'],
                _count: { id: true },
            }),

            // Disputes by mode (in window)
            prisma.answerDispute.groupBy({
                by: ['mode'],
                where: { createdAt: { gte: startTime } },
                _count: { id: true },
            }),

            // Disputes by round (in window)
            prisma.answerDispute.groupBy({
                by: ['round'],
                where: { createdAt: { gte: startTime } },
                _count: { id: true },
            }),

            // Pending disputes with age
            prisma.answerDispute.findMany({
                where: { status: 'PENDING' },
                select: {
                    id: true,
                    createdAt: true,
                    mode: true,
                    user: {
                        select: { displayName: true, email: true },
                    },
                    question: {
                        select: { question: true },
                    },
                },
                orderBy: { createdAt: 'asc' },
            }),

            // All issues in window
            prisma.issueReport.findMany({
                where: { createdAt: { gte: startTime } },
                select: {
                    id: true,
                    status: true,
                    category: true,
                    createdAt: true,
                    resolvedAt: true,
                },
                orderBy: { createdAt: 'asc' },
            }),

            // Issues by status (all time)
            prisma.issueReport.groupBy({
                by: ['status'],
                _count: { id: true },
            }),

            // Issues by category (in window)
            prisma.issueReport.groupBy({
                by: ['category'],
                where: { createdAt: { gte: startTime } },
                _count: { id: true },
            }),

            // Open issues with age
            prisma.issueReport.findMany({
                where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
                select: {
                    id: true,
                    status: true,
                    category: true,
                    subject: true,
                    createdAt: true,
                    user: {
                        select: { displayName: true, email: true },
                    },
                },
                orderBy: { createdAt: 'asc' },
            }),
        ])

        // Generate time buckets
        const buckets: Map<string, {
            timestamp: string
            disputesCreated: number
            disputesResolved: number
            issuesCreated: number
            issuesResolved: number
        }> = new Map()

        let currentTime = new Date(startTime)
        while (currentTime <= now) {
            const bucketKey = currentTime.toISOString().slice(0, 10)
            buckets.set(bucketKey, {
                timestamp: bucketKey,
                disputesCreated: 0,
                disputesResolved: 0,
                issuesCreated: 0,
                issuesResolved: 0,
            })
            currentTime = new Date(currentTime.getTime() + bucketMs)
        }

        // Process disputes into buckets
        allDisputes.forEach(dispute => {
            const createdKey = dispute.createdAt.toISOString().slice(0, 10)
            if (buckets.has(createdKey)) {
                buckets.get(createdKey)!.disputesCreated++
            }
            if (dispute.resolvedAt) {
                const resolvedKey = dispute.resolvedAt.toISOString().slice(0, 10)
                if (buckets.has(resolvedKey)) {
                    buckets.get(resolvedKey)!.disputesResolved++
                }
            }
        })

        // Process issues into buckets
        allIssues.forEach(issue => {
            const createdKey = issue.createdAt.toISOString().slice(0, 10)
            if (buckets.has(createdKey)) {
                buckets.get(createdKey)!.issuesCreated++
            }
            if (issue.resolvedAt) {
                const resolvedKey = issue.resolvedAt.toISOString().slice(0, 10)
                if (buckets.has(resolvedKey)) {
                    buckets.get(resolvedKey)!.issuesResolved++
                }
            }
        })

        // Build time series
        const timeSeries = Array.from(buckets.values())

        // Calculate aging for pending disputes
        const disputeAging = pendingDisputes.map(d => {
            const ageMs = now.getTime() - d.createdAt.getTime()
            const ageHours = Math.floor(ageMs / (60 * 60 * 1000))
            const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000))
            return {
                id: d.id,
                ageHours,
                ageDays,
                mode: d.mode,
                user: d.user?.displayName || d.user?.email || 'Unknown',
                questionPreview: d.question?.question?.slice(0, 50) + '...',
                createdAt: d.createdAt.toISOString(),
            }
        })

        // Calculate aging for open issues
        const issueAging = openIssues.map(i => {
            const ageMs = now.getTime() - i.createdAt.getTime()
            const ageHours = Math.floor(ageMs / (60 * 60 * 1000))
            const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000))
            return {
                id: i.id,
                ageHours,
                ageDays,
                status: i.status,
                category: i.category,
                subject: i.subject.slice(0, 50) + (i.subject.length > 50 ? '...' : ''),
                user: i.user?.displayName || i.user?.email || 'Anonymous',
                createdAt: i.createdAt.toISOString(),
            }
        })

        // Calculate resolution time stats for resolved disputes
        const resolvedDisputes = allDisputes.filter(d => d.resolvedAt)
        const disputeResolutionTimes = resolvedDisputes.map(d => 
            (d.resolvedAt!.getTime() - d.createdAt.getTime()) / (60 * 60 * 1000) // hours
        )

        const resolvedIssues = allIssues.filter(i => i.resolvedAt)
        const issueResolutionTimes = resolvedIssues.map(i =>
            (i.resolvedAt!.getTime() - i.createdAt.getTime()) / (60 * 60 * 1000) // hours
        )

        // Helper for percentiles
        const percentile = (arr: number[], p: number): number => {
            if (arr.length === 0) return 0
            const sorted = [...arr].sort((a, b) => a - b)
            const index = Math.ceil((p / 100) * sorted.length) - 1
            return Math.round(sorted[Math.max(0, index)])
        }

        // Calculate SLA metrics (e.g., % resolved within 24h, 48h, 72h)
        const disputeSLA = {
            within24h: disputeResolutionTimes.filter(t => t <= 24).length,
            within48h: disputeResolutionTimes.filter(t => t <= 48).length,
            within72h: disputeResolutionTimes.filter(t => t <= 72).length,
            total: disputeResolutionTimes.length,
        }

        const issueSLA = {
            within24h: issueResolutionTimes.filter(t => t <= 24).length,
            within48h: issueResolutionTimes.filter(t => t <= 48).length,
            within72h: issueResolutionTimes.filter(t => t <= 72).length,
            total: issueResolutionTimes.length,
        }

        return jsonResponse({
            window,
            timeSeries,
            disputes: {
                summary: {
                    totalInWindow: allDisputes.length,
                    pending: disputesByStatus.find(s => s.status === 'PENDING')?._count.id || 0,
                    approved: disputesByStatus.find(s => s.status === 'APPROVED')?._count.id || 0,
                    rejected: disputesByStatus.find(s => s.status === 'REJECTED')?._count.id || 0,
                },
                byMode: disputesByMode.map(m => ({
                    mode: m.mode,
                    count: m._count.id,
                })),
                byRound: disputesByRound.map(r => ({
                    round: r.round,
                    count: r._count.id,
                })),
                aging: disputeAging,
                resolutionStats: {
                    p50Hours: percentile(disputeResolutionTimes, 50),
                    p95Hours: percentile(disputeResolutionTimes, 95),
                    avgHours: disputeResolutionTimes.length > 0
                        ? Math.round(disputeResolutionTimes.reduce((a, b) => a + b, 0) / disputeResolutionTimes.length)
                        : 0,
                },
                sla: {
                    ...disputeSLA,
                    pctWithin24h: disputeSLA.total > 0 ? (disputeSLA.within24h / disputeSLA.total) * 100 : 0,
                    pctWithin48h: disputeSLA.total > 0 ? (disputeSLA.within48h / disputeSLA.total) * 100 : 0,
                },
            },
            issues: {
                summary: {
                    totalInWindow: allIssues.length,
                    open: issuesByStatus.find(s => s.status === 'OPEN')?._count.id || 0,
                    inProgress: issuesByStatus.find(s => s.status === 'IN_PROGRESS')?._count.id || 0,
                    resolved: issuesByStatus.find(s => s.status === 'RESOLVED')?._count.id || 0,
                    dismissed: issuesByStatus.find(s => s.status === 'DISMISSED')?._count.id || 0,
                },
                byCategory: issuesByCategory.map(c => ({
                    category: c.category,
                    count: c._count.id,
                })),
                aging: issueAging,
                resolutionStats: {
                    p50Hours: percentile(issueResolutionTimes, 50),
                    p95Hours: percentile(issueResolutionTimes, 95),
                    avgHours: issueResolutionTimes.length > 0
                        ? Math.round(issueResolutionTimes.reduce((a, b) => a + b, 0) / issueResolutionTimes.length)
                        : 0,
                },
                sla: {
                    ...issueSLA,
                    pctWithin24h: issueSLA.total > 0 ? (issueSLA.within24h / issueSLA.total) * 100 : 0,
                    pctWithin48h: issueSLA.total > 0 ? (issueSLA.within48h / issueSLA.total) * 100 : 0,
                },
            },
            timestamp: now.toISOString(),
        })
    } catch (error) {
        return serverErrorResponse('Error fetching abuse metrics', error)
    }
}


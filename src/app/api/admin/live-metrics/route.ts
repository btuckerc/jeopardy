import { jsonResponse, requireAdmin, serverErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const countryDisplayNames = new Intl.DisplayNames(['en'], { type: 'region' })

function formatCountry(code: string | null | undefined): string {
    if (!code) {
        return 'Unknown'
    }

    return countryDisplayNames.of(code.toUpperCase()) || code.toUpperCase()
}

function normalizePath(path: string | null | undefined): string {
    if (!path) {
        return 'Unknown'
    }

    const cleaned = path
        .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id')
        .replace(/\/[A-Za-z0-9_-]{20,}(?=\/|$)/g, '/:id')

    if (cleaned.startsWith('/game/')) return '/game/:id'
    if (cleaned.startsWith('/play/guest-game/')) return '/play/guest-game/:id'
    if (cleaned.startsWith('/practice/category')) return '/practice/category'
    if (cleaned.startsWith('/practice/round/')) return '/practice/round/:round'
    if (cleaned.startsWith('/friends')) return '/friends'
    if (cleaned.startsWith('/daily-challenge/archive')) return '/daily-challenge/archive'
    if (cleaned.startsWith('/daily-challenge')) return '/daily-challenge'

    return cleaned
}

function toTopSegments(values: Array<string | null | undefined>, formatter?: (value: string | null | undefined) => string) {
    const counts = new Map<string, number>()

    values.forEach((value) => {
        const label = formatter ? formatter(value) : (value || 'Unknown')
        counts.set(label, (counts.get(label) || 0) + 1)
    })

    return Array.from(counts.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((left, right) => right.value - left.value)
        .slice(0, 10)
}

/**
 * GET /api/admin/live-metrics
 * Lightweight near-real-time active user snapshot for the admin dashboard.
 */
export async function GET() {
    try {
        const { error: authError } = await requireAdmin()
        if (authError) return authError

        const now = new Date()
        const activeNowCutoff = new Date(now.getTime() - 15 * 60 * 1000)
        const activeHourCutoff = new Date(now.getTime() - 60 * 60 * 1000)

        const [activeNowCount, activeHourCount, activeCountryRows, activeRegionRows, activeNowUsers] = await Promise.all([
            prisma.user.count({
                where: {
                    lastOnlineAt: { gte: activeNowCutoff },
                },
            }),
            prisma.user.count({
                where: {
                    lastOnlineAt: { gte: activeHourCutoff },
                },
            }),
            prisma.user.groupBy({
                by: ['countryCode'],
                where: {
                    lastOnlineAt: { gte: activeNowCutoff },
                    countryCode: { not: null },
                },
                _count: { id: true },
            }),
            prisma.user.groupBy({
                by: ['countryCode', 'regionCode'],
                where: {
                    lastOnlineAt: { gte: activeNowCutoff },
                    countryCode: { not: null },
                    regionCode: { not: null },
                },
                _count: { id: true },
            }),
            prisma.user.findMany({
                where: {
                    lastOnlineAt: { gte: activeNowCutoff },
                },
                select: {
                    lastSeenPath: true,
                },
                take: 1000,
                orderBy: {
                    lastOnlineAt: 'desc',
                },
            }),
        ])

        return jsonResponse({
            timestamp: now.toISOString(),
            activeWindowMinutes: 15,
            activeNowUsers: activeNowCount,
            activeLastHour: activeHourCount,
            activeCountries: activeCountryRows
                .map((row) => ({
                    name: formatCountry(row.countryCode),
                    value: row._count.id,
                }))
                .sort((left, right) => right.value - left.value)
                .slice(0, 10),
            activeRegions: activeRegionRows
                .map((row) => ({
                    name: `${formatCountry(row.countryCode)} · ${row.regionCode}`,
                    value: row._count.id,
                }))
                .sort((left, right) => right.value - left.value)
                .slice(0, 10),
            activePages: toTopSegments(activeNowUsers.map((user) => normalizePath(user.lastSeenPath))),
        })
    } catch (error) {
        return serverErrorResponse('Error fetching live admin metrics', error)
    }
}

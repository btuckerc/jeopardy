import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonResponse, requireAdmin, serverErrorResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/issues/stats
 * Get count of open issues (admin only)
 */
export async function GET(_request: NextRequest) {
    try {
        const { error: authError } = await requireAdmin()
        if (authError) return authError

        // Count open issues (OPEN or IN_PROGRESS)
        const openCount = await prisma.issueReport.count({
            where: {
                status: {
                    in: ['OPEN', 'IN_PROGRESS']
                }
            }
        })

        return jsonResponse({
            openCount
        })
    } catch (error) {
        console.error('Error fetching issue stats:', error)
        return serverErrorResponse('Failed to fetch issue stats', error)
    }
}

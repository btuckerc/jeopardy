import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonResponse, serverErrorResponse, requireAdmin } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/disputes/stats
 * Get count of pending disputes (admin only)
 */
export async function GET(_request: NextRequest) {
    try {
        const { error: authError } = await requireAdmin()
        if (authError) {
            return authError
        }

        // Count pending disputes across all modes
        const pendingCount = await prisma.answerDispute.count({
            where: {
                status: 'PENDING'
            }
        })

        return jsonResponse({
            pendingCount
        })
    } catch (error) {
        console.error('Error fetching dispute stats:', error)
        return serverErrorResponse('Failed to fetch dispute stats', error)
    }
}

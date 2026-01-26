import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, forbiddenResponse, serverErrorResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/disputes/stats
 * Get count of pending disputes (admin only)
 */
export async function GET(_request: NextRequest) {
    try {
        const appUser = await getAppUser()
        if (!appUser) {
            return unauthorizedResponse()
        }

        // Check admin role
        if (appUser.role !== 'ADMIN') {
            return forbiddenResponse('Admin access required')
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


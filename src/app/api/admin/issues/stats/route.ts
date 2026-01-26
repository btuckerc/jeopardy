import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, forbiddenResponse, serverErrorResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/issues/stats
 * Get count of open issues (admin only)
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


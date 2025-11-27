import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse, badRequestResponse, serverErrorResponse, parseBody } from '@/lib/api-utils'
import { z } from 'zod'

interface RouteParams {
    params: Promise<{ id: string }>
}

const rejectDisputeSchema = z.object({
    adminComment: z.string().optional()
})

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/disputes/[id]/reject
 * Reject a dispute (no stats changes)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const appUser = await getAppUser()
        if (!appUser) {
            return unauthorizedResponse()
        }

        // Check admin role
        if (appUser.role !== 'ADMIN') {
            return forbiddenResponse('Admin access required')
        }

        const { id } = await params

        const { data: body, error } = await parseBody(request, rejectDisputeSchema)
        if (error) return error

        const { adminComment } = body

        // Get the dispute
        const dispute = await prisma.answerDispute.findUnique({
            where: { id }
        })

        if (!dispute) {
            return notFoundResponse('Dispute not found')
        }

        if (dispute.status !== 'PENDING') {
            return badRequestResponse('Dispute has already been resolved')
        }

        // Update dispute status
        await prisma.answerDispute.update({
            where: { id },
            data: {
                status: 'REJECTED',
                adminId: appUser.id,
                adminComment: adminComment || null,
                resolvedAt: new Date()
            }
        })

        return jsonResponse({
            success: true,
            message: 'Dispute rejected'
        })
    } catch (error) {
        console.error('Error rejecting dispute:', error)
        return serverErrorResponse('Failed to reject dispute', error)
    }
}


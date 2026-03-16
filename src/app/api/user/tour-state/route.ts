import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils'
import { z } from 'zod'

const tourStatePayloadSchema = z.object({
    action: z.enum(['complete', 'dismiss', 'start'])
})

/**
 * GET /api/user/tour-state
 * Get user's onboarding tour state
 */
export async function GET() {
    try {
        const user = await getAppUser()
        if (!user) {
            return unauthorizedResponse()
        }

        return jsonResponse({
            hasSeenTour: user.hasSeenTour,
            tourCompleted: user.tourCompleted,
            tourDismissed: user.tourDismissed,
            tourDismissedAt: user.tourDismissedAt?.toISOString() || null
        })
    } catch (error) {
        return serverErrorResponse('Failed to fetch tour state', error)
    }
}

/**
 * POST /api/user/tour-state
 * Update user's onboarding tour state
 */
export async function POST(request: Request) {
    try {
        const user = await getAppUser()
        if (!user) {
            return unauthorizedResponse()
        }

        const body = await request.json()
        const parse = tourStatePayloadSchema.safeParse(body)
        if (!parse.success) {
            return jsonResponse({ error: 'Invalid action. Use: complete, dismiss, or start' }, 400)
        }

        const { action } = parse.data

        let updateData: {
            hasSeenTour?: boolean
            tourCompleted?: boolean
            tourDismissed?: boolean
            tourDismissedAt?: Date | null
        } = {}

        switch (action) {
            case 'complete':
                updateData = {
                    hasSeenTour: true,
                    tourCompleted: true,
                    tourDismissed: false,
                }
                break
            case 'dismiss':
                updateData = {
                    hasSeenTour: true,
                    tourDismissed: true,
                    tourDismissedAt: new Date()
                }
                break
            case 'start':
                updateData = {
                    hasSeenTour: true
                }
                break
            default:
                return jsonResponse({ error: 'Invalid action. Use: complete, dismiss, or start' }, 400)
        }

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: updateData,
            select: {
                hasSeenTour: true,
                tourCompleted: true,
                tourDismissed: true,
                tourDismissedAt: true
            }
        })

        return jsonResponse({
            success: true,
            hasSeenTour: updatedUser.hasSeenTour,
            tourCompleted: updatedUser.tourCompleted,
            tourDismissed: updatedUser.tourDismissed,
            tourDismissedAt: updatedUser.tourDismissedAt?.toISOString() || null
        })
    } catch (error) {
        return serverErrorResponse('Failed to update tour state', error)
    }
}

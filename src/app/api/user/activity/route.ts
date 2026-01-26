import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/clerk-auth'
import { jsonResponse, serverErrorResponse, badRequestResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { NextRequest } from 'next/server'

/**
 * POST /api/user/activity
 * Record user activity (last online time and current page)
 * Throttled to update at most once per minute per user
 */
export const POST = withInstrumentation(async (request: NextRequest) => {
    try {
        const user = await requireAuth()
        
        const body = await request.json()
        const { path } = body
        
        if (!path || typeof path !== 'string') {
            return badRequestResponse('path is required and must be a string')
        }

        // Throttle updates: only update if lastOnlineAt is more than 60 seconds ago
        // This prevents excessive database writes while still tracking recent activity
        const now = new Date()
        const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)
        
        // Check current user's lastOnlineAt
        const currentUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { lastOnlineAt: true }
        })

        // Only update if lastOnlineAt is null or more than 1 minute ago
        if (currentUser && currentUser.lastOnlineAt && currentUser.lastOnlineAt > oneMinuteAgo) {
            // Too soon to update, but return success anyway
            return jsonResponse({ success: true, skipped: true })
        }
        
        // Update user's activity
        await prisma.user.update({
            where: { id: user.id },
            data: {
                lastOnlineAt: now,
                lastSeenPath: path
            }
        })

        return jsonResponse({ success: true })
    } catch (error) {
        return serverErrorResponse('Failed to record activity', error)
    }
})

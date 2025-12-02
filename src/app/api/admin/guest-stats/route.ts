import { jsonResponse, serverErrorResponse, requireAdmin } from '@/lib/api-utils'
import { getGuestSessionStats } from '@/lib/guest-sessions'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/guest-stats
 * Get guest session statistics for admin dashboard
 */
export async function GET() {
    try {
        const { error: authError } = await requireAdmin()
        if (authError) return authError

        const stats = await getGuestSessionStats()

        return jsonResponse(stats)
    } catch (error) {
        return serverErrorResponse('Error fetching guest stats', error)
    }
}


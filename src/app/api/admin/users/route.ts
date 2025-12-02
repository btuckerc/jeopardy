import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/clerk-auth'
import { jsonResponse, serverErrorResponse, badRequestResponse } from '@/lib/api-utils'

/**
 * GET /api/admin/users
 * Get all users with their in-progress games and activity data
 * Admin only
 */
export async function GET(request: Request) {
    try {
        await requireAdmin()

        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search')
        const limit = parseInt(searchParams.get('limit') || '100', 10)
        const offset = parseInt(searchParams.get('offset') || '0', 10)
        const sortBy = searchParams.get('sortBy') || 'lastOnlineAt'
        const sortOrder = searchParams.get('sortOrder') || 'desc'

        // Validate sortBy and sortOrder
        const validSortBy = ['lastOnlineAt', 'createdAt'].includes(sortBy) ? sortBy : 'lastOnlineAt'
        const validSortOrder = ['asc', 'desc'].includes(sortOrder) ? sortOrder : 'desc'

        // Build where clause
        const where: any = {}
        
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { displayName: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
            ]
        }

        // Build orderBy clause
        const orderBy: any = {}
        orderBy[validSortBy] = validSortOrder

        // Fetch users with their in-progress games
        const [users, totalCount] = await Promise.all([
            prisma.user.findMany({
                where,
                take: limit,
                skip: offset,
                orderBy,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    displayName: true,
                    createdAt: true,
                    lastOnlineAt: true,
                    lastSeenPath: true,
                    games: {
                        where: {
                            status: 'IN_PROGRESS',
                        },
                        select: {
                            id: true,
                            seed: true,
                            currentRound: true,
                            currentScore: true,
                            createdAt: true,
                            updatedAt: true,
                        },
                        orderBy: { updatedAt: 'desc' },
                    },
                },
            }),
            prisma.user.count({ where }),
        ])

        return jsonResponse({
            users,
            totalCount,
            limit,
            offset,
        })
    } catch (error) {
        return serverErrorResponse('Failed to fetch users', error)
    }
}



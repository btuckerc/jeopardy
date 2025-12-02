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

        // Build where clause
        const where: any = {}
        
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { displayName: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
            ]
        }

        // Fetch users with their in-progress games
        const [users, totalCount] = await Promise.all([
            prisma.user.findMany({
                where,
                take: limit,
                skip: offset,
                orderBy: { lastOnlineAt: 'desc' }, // Most recently active first
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



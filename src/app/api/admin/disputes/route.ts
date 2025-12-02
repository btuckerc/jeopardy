import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, forbiddenResponse, serverErrorResponse, parseSearchParams } from '@/lib/api-utils'
import { z } from 'zod'

const disputesQuerySchema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    mode: z.enum(['GAME', 'PRACTICE', 'DAILY_CHALLENGE']).optional(),
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    pageSize: z.string().optional().transform(val => val ? parseInt(val, 10) : 20)
})

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/disputes
 * List disputes with optional filtering (admin only)
 */
export async function GET(request: NextRequest) {
    try {
        const appUser = await getAppUser()
        if (!appUser) {
            return unauthorizedResponse()
        }

        // Check admin role
        if (appUser.role !== 'ADMIN') {
            return forbiddenResponse('Admin access required')
        }

        const { searchParams } = new URL(request.url)
        const { data: params, error } = parseSearchParams(searchParams, disputesQuerySchema)
        if (error) return error

        const { status, mode, page = 1, pageSize = 20 } = params

        // Build where clause
        const where: any = {}
        if (status) where.status = status
        if (mode) where.mode = mode

        // Get disputes with related data
        const [disputes, total] = await Promise.all([
            prisma.answerDispute.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            displayName: true,
                            name: true,
                            email: true
                        }
                    },
                    admin: {
                        select: {
                            id: true,
                            displayName: true,
                            name: true
                        }
                    },
                    question: {
                        select: {
                            id: true,
                            question: true,
                            answer: true,
                            value: true,
                            round: true,
                            category: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    },
                    override: {
                        select: {
                            id: true,
                            text: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize
            }),
            prisma.answerDispute.count({ where })
        ])

        return jsonResponse({
            disputes,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        })
    } catch (error) {
        console.error('Error fetching disputes:', error)
        return serverErrorResponse('Failed to fetch disputes', error)
    }
}


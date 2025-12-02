import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, forbiddenResponse, serverErrorResponse, parseSearchParams } from '@/lib/api-utils'
import { z } from 'zod'

const issuesQuerySchema = z.object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']).optional(),
    category: z.enum(['BUG', 'CONTENT', 'FEATURE_REQUEST', 'ACCOUNT', 'QUESTION', 'OTHER']).optional(),
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    pageSize: z.string().optional().transform(val => val ? parseInt(val, 10) : 20)
})

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/issues
 * List issue reports with optional filtering (admin only)
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
        const { data: params, error } = parseSearchParams(searchParams, issuesQuerySchema)
        if (error) return error

        const { status, category, page = 1, pageSize = 20 } = params

        // Build where clause
        const where: any = {}
        if (status) where.status = status
        if (category) where.category = category

        // Get issues with related data
        const [issues, total] = await Promise.all([
            prisma.issueReport.findMany({
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
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize
            }),
            prisma.issueReport.count({ where })
        ])

        return jsonResponse({
            issues,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        })
    } catch (error) {
        console.error('Error fetching issues:', error)
        return serverErrorResponse('Failed to fetch issues', error)
    }
}


import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse, badRequestResponse, serverErrorResponse, parseBody } from '@/lib/api-utils'
import { z } from 'zod'

const updateIssueSchema = z.object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']).optional(),
    adminNote: z.string().max(5000).optional()
})

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/issues/[id]
 * Get a specific issue report (admin only)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const appUser = await getAppUser()
        if (!appUser) {
            return unauthorizedResponse()
        }

        // Check admin role
        if (appUser.role !== 'ADMIN') {
            return forbiddenResponse('Admin access required')
        }

        const issue = await prisma.issueReport.findUnique({
            where: { id: params.id },
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
            }
        })

        if (!issue) {
            return notFoundResponse('Issue not found')
        }

        return jsonResponse(issue)
    } catch (error) {
        console.error('Error fetching issue:', error)
        return serverErrorResponse('Failed to fetch issue', error)
    }
}

/**
 * PATCH /api/admin/issues/[id]
 * Update an issue report (admin only)
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const appUser = await getAppUser()
        if (!appUser) {
            return unauthorizedResponse()
        }

        // Check admin role
        if (appUser.role !== 'ADMIN') {
            return forbiddenResponse('Admin access required')
        }

        const { data: body, error } = await parseBody(request, updateIssueSchema)
        if (error) return error

        const { status, adminNote } = body

        // Verify issue exists
        const existingIssue = await prisma.issueReport.findUnique({
            where: { id: params.id }
        })

        if (!existingIssue) {
            return notFoundResponse('Issue not found')
        }

        // Build update data
        const updateData: any = {}
        if (status !== undefined) {
            updateData.status = status
            // Set resolvedAt if status is RESOLVED or DISMISSED
            if (status === 'RESOLVED' || status === 'DISMISSED') {
                if (!existingIssue.resolvedAt) {
                    updateData.resolvedAt = new Date()
                }
            } else {
                // Clear resolvedAt if reopening
                updateData.resolvedAt = null
            }
        }
        if (adminNote !== undefined) {
            updateData.adminNote = adminNote || null
        }
        updateData.adminId = appUser.id

        const updatedIssue = await prisma.issueReport.update({
            where: { id: params.id },
            data: updateData,
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
            }
        })

        return jsonResponse(updatedIssue)
    } catch (error) {
        console.error('Error updating issue:', error)
        return serverErrorResponse('Failed to update issue', error)
    }
}


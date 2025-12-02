import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, badRequestResponse, serverErrorResponse, parseBody } from '@/lib/api-utils'
import { z } from 'zod'

const createIssueSchema = z.object({
    subject: z.string().min(1).max(200),
    message: z.string().min(10).max(5000),
    category: z.enum(['BUG', 'CONTENT', 'FEATURE_REQUEST', 'ACCOUNT', 'QUESTION', 'OTHER']),
    email: z.string().email().optional().or(z.literal('')),
    pageUrl: z.string().url().optional().or(z.literal('')),
    questionId: z.string().uuid().optional().or(z.literal('')),
    gameId: z.string().uuid().optional().or(z.literal(''))
})

export const dynamic = 'force-dynamic'

/**
 * POST /api/issues
 * Create a new issue report (public endpoint, supports both authenticated and unauthenticated users)
 */
export async function POST(request: NextRequest) {
    try {
        const appUser = await getAppUser()
        
        const { data: body, error } = await parseBody(request, createIssueSchema)
        if (error) return error

        const { subject, message, category, email, pageUrl, questionId, gameId } = body

        // Get user agent from headers
        const userAgent = request.headers.get('user-agent') || undefined

        // Validate that if unauthenticated, email is provided
        if (!appUser && !email) {
            return badRequestResponse('Email is required for unauthenticated users')
        }

        // Optional: Verify question exists if questionId provided
        if (questionId) {
            const question = await prisma.question.findUnique({
                where: { id: questionId },
                select: { id: true }
            })
            if (!question) {
                return badRequestResponse('Question not found')
            }
        }

        // Optional: Verify game exists if gameId provided
        if (gameId) {
            const game = await prisma.game.findUnique({
                where: { id: gameId },
                select: { id: true }
            })
            if (!game) {
                return badRequestResponse('Game not found')
            }
        }

        // Create the issue report
        const issueReport = await prisma.issueReport.create({
            data: {
                userId: appUser?.id || null,
                email: email || null,
                subject: subject.trim(),
                message: message.trim(),
                category,
                pageUrl: pageUrl || null,
                questionId: questionId || null,
                gameId: gameId || null,
                userAgent: userAgent || null
            }
        })

        return jsonResponse({
            success: true,
            issueId: issueReport.id
        }, 201)
    } catch (error) {
        console.error('Error creating issue report:', error)
        return serverErrorResponse('Failed to create issue report', error)
    }
}


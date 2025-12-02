import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, forbiddenResponse, badRequestResponse, serverErrorResponse, parseBody } from '@/lib/api-utils'
import { z } from 'zod'

const sendIssueEmailSchema = z.object({
    issueId: z.string().uuid(),
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(5000)
})

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/issues/send-email
 * Send an email to the user who reported an issue
 * Admin only
 */
export async function POST(request: NextRequest) {
    try {
        const appUser = await getAppUser()
        if (!appUser) {
            return unauthorizedResponse()
        }

        // Check admin role
        if (appUser.role !== 'ADMIN') {
            return forbiddenResponse('Admin access required')
        }

        const { data: body, error } = await parseBody(request, sendIssueEmailSchema)
        if (error) return error

        const { issueId, subject, body: emailBody } = body

        // Fetch the issue with user info
        const issue = await prisma.issueReport.findUnique({
            where: { id: issueId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        displayName: true,
                        name: true
                    }
                }
            }
        })

        if (!issue) {
            return badRequestResponse('Issue not found')
        }

        // Determine recipient email - prefer user email, fallback to issue email
        const recipientEmail = issue.user?.email || issue.email

        if (!recipientEmail) {
            return badRequestResponse('Issue reporter has no email address')
        }

        // Determine recipient name
        const recipientName = issue.user?.displayName || issue.user?.name || issue.email || recipientEmail

        // Import and use the email utility
        const { sendEmail } = await import('@/lib/email')

        // Send the email
        await sendEmail({
            to: recipientEmail,
            subject,
            text: emailBody,
            html: `<p>${emailBody.replace(/\n/g, '<br>')}</p>`,
        })

        return jsonResponse({
            success: true,
            message: `Email sent to ${recipientName} (${recipientEmail})`,
        })
    } catch (error) {
        console.error('Error sending issue email:', error)
        return serverErrorResponse('Failed to send email', error)
    }
}


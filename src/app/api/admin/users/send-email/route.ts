import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/clerk-auth'
import { jsonResponse, serverErrorResponse, badRequestResponse } from '@/lib/api-utils'

/**
 * POST /api/admin/users/send-email
 * Send an email to a user
 * Admin only
 */
export async function POST(request: Request) {
    try {
        await requireAdmin()

        const body = await request.json()
        const { userId, subject, body: emailBody } = body

        if (!userId || !subject || !emailBody) {
            return badRequestResponse('userId, subject, and body are required')
        }

        // Fetch the target user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, displayName: true, name: true },
        })

        if (!user || !user.email) {
            return badRequestResponse('User not found or has no email address')
        }

        // Import and use the email utility
        const { sendEmail } = await import('@/lib/email')

        // Determine recipient name
        const recipientName = user.displayName || user.name || user.email

        // Send the email
        await sendEmail({
            to: user.email,
            subject,
            text: emailBody,
            html: `<p>${emailBody.replace(/\n/g, '<br>')}</p>`,
        })

        return jsonResponse({
            success: true,
            message: `Email sent to ${recipientName} (${user.email})`,
        })
    } catch (error) {
        return serverErrorResponse('Failed to send email', error)
    }
}


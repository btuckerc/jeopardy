/**
 * Cron Job: Issues Summary Email
 * 
 * Sends a daily email summary of all open issues to admin users.
 * Runs daily to ensure admins are aware of outstanding issues that need review.
 * Uses CRON_SECRET for authentication (no admin required).
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { withCronLogging } from '@/lib/cron-logger'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 1 minute max for querying and sending emails

export async function GET(request: Request) {
    try {
        // Verify cron secret to prevent unauthorized access
        const authHeader = request.headers.get('authorization')
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        // Check if logging is already handled (from manual trigger)
        const skipLogging = request.headers.get('x-skip-cron-logging') === 'true'
        const triggeredBy = request.headers.get('x-triggered-by') || 'scheduled'

        const executeJob = async () => {
            // Query all open issues (OPEN or IN_PROGRESS) with related data
            const issues = await prisma.issueReport.findMany({
                where: {
                    status: {
                        in: ['OPEN', 'IN_PROGRESS']
                    }
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            displayName: true,
                            name: true,
                            email: true
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
                orderBy: { createdAt: 'asc' }
            })

            const openCount = issues.length

            // If no issues, return early without sending email
            if (openCount === 0) {
                return {
                    success: true,
                    message: 'No open issues to report',
                    openCount: 0,
                    recipientCount: 0,
                    successfulEmails: 0,
                    failedEmails: 0
                }
            }

            // Get all admin users
            const admins = await prisma.user.findMany({
                where: {
                    role: 'ADMIN',
                    email: {
                        not: null
                    }
                },
                select: {
                    id: true,
                    email: true,
                    displayName: true,
                    name: true
                }
            })

            if (admins.length === 0) {
                return {
                    success: true,
                    message: 'No admin users found to send email to',
                    openCount,
                    recipientCount: 0,
                    successfulEmails: 0,
                    failedEmails: 0
                }
            }

            // Group issues by category
            const byCategory: Record<string, number> = {}
            issues.forEach(issue => {
                byCategory[issue.category] = (byCategory[issue.category] || 0) + 1
            })

            // Group issues by status
            const byStatus: Record<string, number> = {}
            issues.forEach(issue => {
                byStatus[issue.status] = (byStatus[issue.status] || 0) + 1
            })

            const today = format(new Date(), 'MMMM d, yyyy')
            const subject = `trivrdy Issues Summary - ${openCount} Open Issue${openCount !== 1 ? 's' : ''} (${today})`

            // Build text version
            let textBody = `trivrdy Issues Summary - ${today}\n\n`
            textBody += `Total Open Issues: ${openCount}\n\n`
            
            textBody += `By Category:\n`
            Object.entries(byCategory).forEach(([category, count]) => {
                textBody += `  ${category}: ${count}\n`
            })
            
            textBody += `\nBy Status:\n`
            Object.entries(byStatus).forEach(([status, count]) => {
                textBody += `  ${status}: ${count}\n`
            })
            
            textBody += `\n\nIssues:\n\n`
            issues.forEach((issue, index) => {
                const userName = issue.user?.displayName || issue.user?.name || issue.user?.email || issue.email || 'Unknown'
                const userEmail = issue.user?.email || issue.email || 'No email'
                const createdAt = format(new Date(issue.createdAt), 'MMM d, yyyy h:mm a')
                
                textBody += `${index + 1}. ${issue.subject}\n`
                textBody += `   Category: ${issue.category}\n`
                textBody += `   Status: ${issue.status}\n`
                textBody += `   Submitted by: ${userName} (${userEmail})\n`
                textBody += `   Date: ${createdAt}\n`
                if (issue.pageUrl) {
                    textBody += `   Page: ${issue.pageUrl}\n`
                }
                if (issue.question) {
                    textBody += `   Related Question: ${issue.question.question.substring(0, 100)}...\n`
                }
                textBody += `   Message: ${issue.message.substring(0, 200)}${issue.message.length > 200 ? '...' : ''}\n`
                textBody += `\n`
            })
            
            textBody += `\nPlease review and resolve issues in the admin panel.\n`

            // Build HTML version
            let htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .header .count { font-size: 36px; font-weight: 700; margin: 10px 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .summary-box { background: white; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .summary-box h3 { margin-top: 0; color: #f59e0b; font-size: 18px; }
        .stats-grid { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 15px; }
        .stat { background: #f3f4f6; padding: 12px 20px; border-radius: 6px; flex: 1; min-width: 150px; }
        .stat .label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
        .stat .value { font-size: 24px; font-weight: 700; color: #111827; margin-top: 4px; }
        .issue-card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .issue-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 2px solid #e5e7eb; }
        .issue-id { font-family: 'Monaco', 'Courier New', monospace; font-size: 12px; color: #6b7280; }
        .issue-date { color: #6b7280; font-size: 14px; }
        .issue-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0; }
        .info-item { }
        .info-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .info-value { font-size: 14px; color: #111827; font-weight: 500; }
        .message-box { background: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 3px solid #f59e0b; }
        .message-box .label { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; }
        .message-box .text { font-size: 14px; color: #111827; line-height: 1.6; white-space: pre-wrap; }
        .status-badge { padding: 6px 12px; border-radius: 4px; display: inline-block; font-weight: 600; font-size: 12px; }
        .status-badge.open { background: #fef3c7; color: #92400e; }
        .status-badge.in-progress { background: #dbeafe; color: #1e40af; }
        .category-badge { padding: 4px 10px; border-radius: 4px; display: inline-block; font-weight: 500; font-size: 11px; background: #e5e7eb; color: #374151; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Open Issues Summary</h1>
        <div class="count">
            ${openCount} Issue${openCount !== 1 ? 's' : ''}
        </div>
    </div>
    <div class="content">
        <div class="summary-box">
            <h3>Summary</h3>
            <div class="stats-grid">
                <div class="stat">
                    <div class="label">Total Issues</div>
                    <div class="value">${openCount}</div>
                </div>
                ${Object.entries(byStatus).map(([status, count]) => `
                <div class="stat">
                    <div class="label">${status.replace('_', ' ')}</div>
                    <div class="value">${count}</div>
                </div>
                `).join('')}
            </div>
            <div style="margin-top: 20px;">
                <div class="label" style="font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 10px;">By Category</div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    ${Object.entries(byCategory).map(([category, count]) => `
                    <div class="category-badge">${category.replace('_', ' ')}: ${count}</div>
                    `).join('')}
                </div>
            </div>
        </div>
`

            // Add each issue
            htmlBody += issues.map((issue, index) => {
                const userName = issue.user?.displayName || issue.user?.name || issue.user?.email || issue.email || 'Unknown'
                const userEmail = issue.user?.email || issue.email || 'No email'
                const createdAt = format(new Date(issue.createdAt), 'MMM d, yyyy h:mm a')
                const statusClass = issue.status === 'OPEN' ? 'open' : 'in-progress'
                
                const questionText = issue.question 
                    ? issue.question.question.substring(0, 200) + (issue.question.question.length > 200 ? '...' : '')
                    : 'N/A'
                
                return `
        <div class="issue-card">
            <div class="issue-header">
                <div>
                    <div style="font-weight: 600; font-size: 16px; color: #111827; margin-bottom: 5px;">${index + 1}. ${issue.subject}</div>
                    <div class="issue-id">Issue #${issue.id.substring(0, 8)}</div>
                </div>
                <div class="issue-date">${createdAt}</div>
            </div>
            
            <div class="issue-info">
                <div class="info-item">
                    <div class="info-label">Category</div>
                    <div class="info-value">${issue.category.replace('_', ' ')}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Status</div>
                    <div class="info-value">
                        <span class="status-badge ${statusClass}">${issue.status.replace('_', ' ')}</span>
                    </div>
                </div>
                <div class="info-item">
                    <div class="info-label">Submitted By</div>
                    <div class="info-value">${userName}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Email</div>
                    <div class="info-value">${userEmail}</div>
                </div>
                ${issue.pageUrl ? `
                <div class="info-item">
                    <div class="info-label">Page URL</div>
                    <div class="info-value" style="word-break: break-all; font-size: 12px;">${issue.pageUrl}</div>
                </div>
                ` : ''}
                ${issue.question ? `
                <div class="info-item">
                    <div class="info-label">Related Question</div>
                    <div class="info-value" style="font-size: 12px;">${questionText}</div>
                </div>
                ` : ''}
            </div>
            
            <div class="message-box">
                <div class="label">Message</div>
                <div class="text">${issue.message}</div>
            </div>
        </div>`
            }).join('')

            htmlBody += `
        <div class="footer">
            <p>This is an automated summary of open issues. Please review and resolve issues in the admin panel.</p>
        </div>
    </div>
</body>
</html>`

            // Send email to each admin
            const emailResults: Array<{ email: string; success: boolean; error?: string }> = []
            
            for (const admin of admins) {
                try {
                    await sendEmail({
                        to: admin.email!,
                        subject,
                        text: textBody,
                        html: htmlBody
                    })
                    emailResults.push({ email: admin.email!, success: true })
                } catch (error: any) {
                    console.error(`Failed to send issues summary email to ${admin.email}:`, error)
                    emailResults.push({ 
                        email: admin.email!, 
                        success: false, 
                        error: error.message || 'Unknown error' 
                    })
                }
            }

            const successfulEmails = emailResults.filter(r => r.success).length
            const failedEmails = emailResults.filter(r => !r.success).length

            // Build detailed result for admin view
            const issueSummaries = issues.map(issue => ({
                id: issue.id,
                subject: issue.subject,
                category: issue.category,
                status: issue.status,
                userName: issue.user?.displayName || issue.user?.name || issue.user?.email || issue.email || 'Unknown',
                userEmail: issue.user?.email || issue.email || 'No email',
                createdAt: format(new Date(issue.createdAt), 'yyyy-MM-dd HH:mm:ss'),
                pageUrl: issue.pageUrl,
                questionId: issue.questionId
            }))

            return {
                success: true,
                openCount,
                recipientCount: admins.length,
                successfulEmails,
                failedEmails,
                emailStatus: {
                    sent: successfulEmails,
                    failed: failedEmails,
                    recipients: admins.map(a => ({ name: a.displayName || a.name || 'Admin', email: a.email! })),
                    results: emailResults
                },
                summary: {
                    totalIssues: openCount,
                    byCategory,
                    byStatus
                },
                issues: issueSummaries
            }
        }

        // Wrap with logging if not already handled
        if (skipLogging) {
            const result = await executeJob()
            return NextResponse.json(result)
        } else {
            const result = await withCronLogging('issues-summary', triggeredBy, executeJob)
            return NextResponse.json(result)
        }
    } catch (error: any) {
        console.error('Error in issues summary cron job:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: error.message || 'Unknown error',
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        )
    }
}


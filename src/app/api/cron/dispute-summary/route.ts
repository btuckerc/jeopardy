/**
 * Cron Job: Dispute Summary Email
 * 
 * Sends a daily email summary of all pending answer disputes to admin users.
 * Runs daily to ensure admins are aware of outstanding disputes that need review.
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
            // Query all pending disputes with related data
            const disputes = await prisma.answerDispute.findMany({
                where: {
                    status: 'PENDING'
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

            const pendingCount = disputes.length

            // If no disputes, return early without sending email
            if (pendingCount === 0) {
                return {
                    success: true,
                    pendingCount: 0,
                    message: 'No pending disputes; no email sent.',
                    recipientCount: 0,
                    summary: {
                        totalDisputes: 0,
                        byMode: {},
                        oldestDispute: null,
                        newestDispute: null
                    },
                    emailStatus: {
                        sent: 0,
                        failed: 0,
                        recipients: []
                    }
                }
            }

            // Query all admin users with email addresses
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

            const recipientCount = admins.length

            if (recipientCount === 0) {
                // Build summary even if no recipients
                const summaryByMode: Record<string, number> = {}
                disputes.forEach(d => {
                    summaryByMode[d.mode] = (summaryByMode[d.mode] || 0) + 1
                })

                return {
                    success: true,
                    pendingCount,
                    message: 'No admin users with email addresses found; no email sent.',
                    recipientCount: 0,
                    summary: {
                        totalDisputes: pendingCount,
                        byMode: summaryByMode,
                        oldestDispute: format(disputes[0].createdAt, 'yyyy-MM-dd HH:mm:ss'),
                        newestDispute: format(disputes[disputes.length - 1].createdAt, 'yyyy-MM-dd HH:mm:ss')
                    },
                    emailStatus: {
                        sent: 0,
                        failed: 0,
                        recipients: []
                    }
                }
            }

            // Group disputes by mode for summary
            const disputesByMode = disputes.reduce((acc, dispute) => {
                const mode = dispute.mode
                if (!acc[mode]) {
                    acc[mode] = []
                }
                acc[mode].push(dispute)
                return acc
            }, {} as Record<string, typeof disputes>)

            // Build summary statistics
            const summaryByMode: Record<string, number> = {}
            Object.entries(disputesByMode).forEach(([mode, modeDisputes]) => {
                summaryByMode[mode] = modeDisputes.length
            })

            // Build email subject
            const subject = `Pending Answer Disputes: ${pendingCount} outstanding`

            // Build text email body with improved formatting
            let textBody = `═══════════════════════════════════════════════════════\n`
            textBody += `  PENDING ANSWER DISPUTES SUMMARY\n`
            textBody += `═══════════════════════════════════════════════════════\n\n`
            textBody += `There are ${pendingCount} pending answer dispute(s) that require review.\n\n`
            
            // Summary by mode
            textBody += `SUMMARY BY MODE:\n`
            textBody += `─────────────────────────────────────────────────────────\n`
            for (const [mode, count] of Object.entries(summaryByMode)) {
                textBody += `  ${mode.padEnd(20)} ${count} dispute(s)\n`
            }
            
            textBody += `\n═══════════════════════════════════════════════════════\n`
            textBody += `  DISPUTE DETAILS\n`
            textBody += `═══════════════════════════════════════════════════════\n\n`

            disputes.forEach((dispute, index) => {
                const userDisplayName = dispute.user.displayName || dispute.user.name || dispute.user.email || 'Unknown User'
                const questionText = dispute.question.question.length > 150 
                    ? dispute.question.question.substring(0, 150) + '...' 
                    : dispute.question.question
                const userAnswerText = dispute.userAnswer.length > 100
                    ? dispute.userAnswer.substring(0, 100) + '...'
                    : dispute.userAnswer
                
                textBody += `${index + 1}. DISPUTE ID: ${dispute.id}\n`
                textBody += `   ───────────────────────────────────────────────────────\n`
                textBody += `   Created:     ${format(dispute.createdAt, 'yyyy-MM-dd HH:mm:ss')}\n`
                textBody += `   User:        ${userDisplayName}\n`
                textBody += `   Email:       ${dispute.user.email || 'N/A'}\n`
                textBody += `   Mode:        ${dispute.mode}\n`
                textBody += `   Round:       ${dispute.round}\n`
                textBody += `   Category:    ${dispute.question.category.name}\n`
                textBody += `   Value:       $${dispute.question.value}\n`
                textBody += `   ───────────────────────────────────────────────────────\n`
                textBody += `   Question:\n   ${questionText.split('\n').map(line => `   ${line}`).join('\n')}\n\n`
                textBody += `   Correct Answer: ${dispute.question.answer}\n`
                textBody += `   User Answer:    ${userAnswerText}\n`
                textBody += `   System Judged:  ${dispute.systemWasCorrect ? '✓ Correct' : '✗ Incorrect'}\n`
                textBody += `\n`
            })

            // Build HTML email body with improved styling
            let htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .header .count { font-size: 36px; font-weight: 700; margin: 10px 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .summary-box { background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .summary-box h3 { margin-top: 0; color: #667eea; font-size: 18px; }
        .mode-stats { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 15px; }
        .mode-stat { background: #f3f4f6; padding: 12px 20px; border-radius: 6px; flex: 1; min-width: 150px; }
        .mode-stat .label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
        .mode-stat .value { font-size: 24px; font-weight: 700; color: #111827; margin-top: 4px; }
        .dispute-card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .dispute-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 2px solid #e5e7eb; }
        .dispute-id { font-family: 'Monaco', 'Courier New', monospace; font-size: 12px; color: #6b7280; }
        .dispute-date { color: #6b7280; font-size: 14px; }
        .dispute-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0; }
        .info-item { }
        .info-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .info-value { font-size: 14px; color: #111827; font-weight: 500; }
        .question-box { background: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 3px solid #3b82f6; }
        .question-box .label { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; }
        .question-box .text { font-size: 14px; color: #111827; line-height: 1.6; }
        .answer-comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0; }
        .answer-box { padding: 15px; border-radius: 6px; }
        .answer-box.correct { background: #d1fae5; border-left: 3px solid #10b981; }
        .answer-box.user { background: #dbeafe; border-left: 3px solid #3b82f6; }
        .answer-box .label { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; font-weight: 600; }
        .answer-box .text { font-size: 14px; color: #111827; }
        .system-judgment { padding: 10px 15px; border-radius: 6px; display: inline-block; margin-top: 10px; font-weight: 600; font-size: 13px; }
        .system-judgment.correct { background: #d1fae5; color: #065f46; }
        .system-judgment.incorrect { background: #fee2e2; color: #991b1b; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Pending Answer Disputes</h1>
        <div class="count">${pendingCount}</div>
        <div style="font-size: 14px; opacity: 0.9;">Require Review</div>
    </div>
    
    <div class="content">
        <div class="summary-box">
            <h3>Summary by Mode</h3>
            <div class="mode-stats">`

            for (const [mode, count] of Object.entries(summaryByMode)) {
                htmlBody += `
                <div class="mode-stat">
                    <div class="label">${mode.replace('_', ' ')}</div>
                    <div class="value">${count}</div>
                </div>`
            }

            htmlBody += `
            </div>
        </div>`

            // Build dispute cards
            disputes.forEach((dispute, index) => {
                const userDisplayName = dispute.user.displayName || dispute.user.name || dispute.user.email || 'Unknown User'
                const questionText = dispute.question.question.replace(/</g, '&lt;').replace(/>/g, '&gt;')
                const userAnswerText = dispute.userAnswer.replace(/</g, '&lt;').replace(/>/g, '&gt;')
                const correctAnswerText = dispute.question.answer.replace(/</g, '&lt;').replace(/>/g, '&gt;')
                const systemJudgmentClass = dispute.systemWasCorrect ? 'correct' : 'incorrect'
                const systemJudgmentText = dispute.systemWasCorrect ? '✓ System Judged Correct' : '✗ System Judged Incorrect'
                
                htmlBody += `
        <div class="dispute-card">
            <div class="dispute-header">
                <div>
                    <strong style="font-size: 18px;">Dispute #${index + 1}</strong>
                    <div class="dispute-id">ID: ${dispute.id}</div>
                </div>
                <div class="dispute-date">${format(dispute.createdAt, 'MMM dd, yyyy HH:mm')}</div>
            </div>
            
            <div class="dispute-info">
                <div class="info-item">
                    <div class="info-label">User</div>
                    <div class="info-value">${userDisplayName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${(dispute.user.email || 'No email').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Mode</div>
                    <div class="info-value">${dispute.mode}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Round</div>
                    <div class="info-value">${dispute.round}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Category</div>
                    <div class="info-value">${dispute.question.category.name.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Value</div>
                    <div class="info-value">$${dispute.question.value}</div>
                </div>
            </div>
            
            <div class="question-box">
                <div class="label">Question</div>
                <div class="text">${questionText}</div>
            </div>
            
            <div class="answer-comparison">
                <div class="answer-box correct">
                    <div class="label">Correct Answer</div>
                    <div class="text">${correctAnswerText}</div>
                </div>
                <div class="answer-box user">
                    <div class="label">User Answer</div>
                    <div class="text">${userAnswerText}</div>
                </div>
            </div>
            
            <div>
                <span class="system-judgment ${systemJudgmentClass}">${systemJudgmentText}</span>
            </div>
        </div>`
            })

            htmlBody += `
        <div class="footer">
            <p>This is an automated summary of pending disputes. Please review and resolve disputes in the admin panel.</p>
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
                } catch (error: unknown) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
                    console.error(`Failed to send dispute summary email to ${admin.email}:`, error)
                    emailResults.push({ 
                        email: admin.email!, 
                        success: false, 
                        error: errorMsg
                    })
                }
            }

            const successfulEmails = emailResults.filter(r => r.success).length
            const failedEmails = emailResults.filter(r => !r.success).length

            // Build detailed result for admin view
            const disputeSummaries = disputes.map(d => ({
                id: d.id,
                createdAt: format(d.createdAt, 'yyyy-MM-dd HH:mm:ss'),
                userId: d.user.id,
                userName: d.user.displayName || d.user.name || d.user.email || 'Unknown',
                userEmail: d.user.email || null,
                mode: d.mode,
                round: d.round,
                category: d.question.category.name,
                questionValue: d.question.value,
                questionPreview: d.question.question.length > 80 
                    ? d.question.question.substring(0, 80) + '...' 
                    : d.question.question,
                userAnswer: d.userAnswer.length > 60 
                    ? d.userAnswer.substring(0, 60) + '...' 
                    : d.userAnswer,
                systemWasCorrect: d.systemWasCorrect
            }))

            return {
                success: true,
                pendingCount,
                recipientCount,
                successfulEmails,
                failedEmails,
                message: `Sent dispute summary to ${successfulEmails} admin(s)${failedEmails > 0 ? ` (${failedEmails} failed)` : ''}`,
                summary: {
                    totalDisputes: pendingCount,
                    byMode: summaryByMode,
                    oldestDispute: format(disputes[0].createdAt, 'yyyy-MM-dd HH:mm:ss'),
                    newestDispute: format(disputes[disputes.length - 1].createdAt, 'yyyy-MM-dd HH:mm:ss')
                },
                emailStatus: {
                    sent: successfulEmails,
                    failed: failedEmails,
                    recipients: admins.map(a => ({
                        email: a.email,
                        name: a.displayName || a.name || 'Unknown'
                    })),
                    results: emailResults
                },
                disputes: disputeSummaries.slice(0, 20) // Include first 20 disputes for admin view
            }
        }

        // Wrap with logging if not already handled
        if (skipLogging) {
            const result = await executeJob()
            return NextResponse.json(result)
        } else {
            const result = await withCronLogging('dispute-summary', triggeredBy, executeJob)
            return NextResponse.json(result)
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('Cron job error:', error)
        return NextResponse.json(
            {
                success: false,
                error: message
            },
            { status: 500 }
        )
    }
}


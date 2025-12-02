import nodemailer from 'nodemailer'

/**
 * Email configuration from environment variables
 * For Gmail SMTP:
 * - SMTP_HOST: smtp.gmail.com
 * - SMTP_PORT: 587
 * - SMTP_USER: your Gmail address
 * - SMTP_PASS: Gmail App Password (not your regular password)
 * - EMAIL_FROM: "Trivrdy" <yourgmail@example.com>
 */
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com'
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10)
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
const EMAIL_FROM = process.env.EMAIL_FROM || 'Trivrdy <noreply@trivrdy.com>'

// Create reusable transporter (singleton pattern)
let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
    if (transporter) {
        return transporter
    }

    if (!SMTP_USER || !SMTP_PASS) {
        throw new Error('SMTP_USER and SMTP_PASS environment variables must be set to send emails')
    }

    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465, // true for 465, false for other ports
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    })

    return transporter
}

export interface SendEmailOptions {
    to: string
    subject: string
    text?: string
    html?: string
}

/**
 * Send an email using the configured SMTP transporter
 * 
 * @param options - Email options (to, subject, text, html)
 * @returns Promise that resolves when email is sent
 * @throws Error if SMTP is not configured or sending fails
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
    const { to, subject, text, html } = options

    if (!to || !subject) {
        throw new Error('to and subject are required')
    }

    if (!text && !html) {
        throw new Error('Either text or html must be provided')
    }

    try {
        const mailTransporter = getTransporter()

        const info = await mailTransporter.sendMail({
            from: EMAIL_FROM,
            to,
            subject,
            text: text || undefined,
            html: html || undefined,
        })

        console.log('Email sent successfully:', {
            messageId: info.messageId,
            to,
            subject,
        })
    } catch (error) {
        console.error('Failed to send email:', error)
        throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
}

/**
 * Verify SMTP connection configuration
 * Useful for testing/debugging email setup
 */
export async function verifyEmailConfig(): Promise<boolean> {
    try {
        const mailTransporter = getTransporter()
        await mailTransporter.verify()
        console.log('SMTP configuration is valid')
        return true
    } catch (error) {
        console.error('SMTP configuration is invalid:', error)
        return false
    }
}


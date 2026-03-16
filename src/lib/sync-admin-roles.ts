/**
 * Sync admin roles based on ADMIN_EMAILS environment variable.
 * This runs on app startup to ensure admin roles are always in sync with config.
 */

import { prisma } from './prisma'

function getConfiguredAdminEmails(): string[] {
    return (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
}

let hasSynced = false

/**
 * Sync admin roles for all users based on ADMIN_EMAILS env var.
 * When ADMIN_EMAILS is configured, the env list is treated as the authoritative admin source.
 * This function is idempotent and only runs once per app lifecycle.
 */
export async function syncAdminRoles(): Promise<void> {
    // Only run once per app lifecycle
    if (hasSynced) return
    hasSynced = true

    const adminEmails = getConfiguredAdminEmails()

    if (adminEmails.length === 0) {
        console.log('[Admin Sync] No ADMIN_EMAILS configured')
        return
    }

    console.log(`[Admin Sync] Checking admin roles for: ${adminEmails.join(', ')}`)

    try {
        const [promoted, demoted] = await prisma.$transaction([
            prisma.user.updateMany({
                where: {
                    email: {
                        in: adminEmails,
                        mode: 'insensitive',
                    },
                    role: 'USER',
                },
                data: { role: 'ADMIN' },
            }),
            prisma.user.updateMany({
                where: {
                    role: 'ADMIN',
                    OR: [
                        { email: null },
                        {
                            NOT: {
                                email: {
                                    in: adminEmails,
                                    mode: 'insensitive',
                                },
                            },
                        },
                    ],
                },
                data: { role: 'USER' },
            }),
        ])

        console.log(`[Admin Sync] Promoted ${promoted.count} user(s) to ADMIN role`)
        console.log(`[Admin Sync] Demoted ${demoted.count} user(s) to USER role`)
    } catch (error) {
        console.error('[Admin Sync] Error syncing admin roles:', error)
    }
}

/**
 * Sync admin roles based on ADMIN_EMAILS environment variable.
 * This runs on app startup to ensure admin roles are always in sync with config.
 */

import { prisma } from './prisma'

// Get admin emails from environment variable (comma-separated list)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

let hasSynced = false

/**
 * Sync admin roles for all users based on ADMIN_EMAILS env var.
 * Only promotes users to admin, never demotes (to preserve manual admin assignments).
 * This function is idempotent and only runs once per app lifecycle.
 */
export async function syncAdminRoles(): Promise<void> {
    // Only run once per app lifecycle
    if (hasSynced) return
    hasSynced = true

    if (ADMIN_EMAILS.length === 0) {
        console.log('[Admin Sync] No ADMIN_EMAILS configured')
        return
    }

    console.log(`[Admin Sync] Checking admin roles for: ${ADMIN_EMAILS.join(', ')}`)

    try {
        // Find users whose emails are in ADMIN_EMAILS but don't have ADMIN role
        const usersToPromote = await prisma.user.findMany({
            where: {
                email: {
                    in: ADMIN_EMAILS,
                    mode: 'insensitive'
                },
                role: 'USER'
            },
            select: {
                id: true,
                email: true
            }
        })

        if (usersToPromote.length === 0) {
            console.log('[Admin Sync] All configured admin users already have ADMIN role')
            return
        }

        // Promote users to admin
        for (const user of usersToPromote) {
            await prisma.user.update({
                where: { id: user.id },
                data: { role: 'ADMIN' }
            })
            console.log(`[Admin Sync] Promoted ${user.email} to ADMIN role`)
        }

        console.log(`[Admin Sync] Promoted ${usersToPromote.length} user(s) to ADMIN role`)
    } catch (error) {
        console.error('[Admin Sync] Error syncing admin roles:', error)
    }
}


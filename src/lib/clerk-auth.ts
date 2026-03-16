/**
 * Clerk Authentication Utilities
 * 
 * This module provides helpers to bridge Clerk authentication with our Prisma User model.
 * It handles:
 * - Syncing Clerk users to Prisma on first login
 * - Generating display names for new users
 * - Managing admin roles based on ADMIN_EMAILS env var
 * - Providing a unified interface for accessing user data
 */

import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from './prisma'
import { generateUniqueDisplayName } from './display-name'
import type { UserRole } from '@prisma/client'

function getConfiguredAdminEmails(): string[] {
    return (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
}

function hasConfiguredAdminEmails(): boolean {
    return getConfiguredAdminEmails().length > 0
}

/**
 * Check if an email should have admin role based on ADMIN_EMAILS env var
 */
export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false
    return getConfiguredAdminEmails().includes(email.toLowerCase())
}

export async function getCurrentClerkPrimaryEmail(): Promise<string | null> {
    const clerkUser = await getClerkUser()
    return clerkUser?.emailAddresses[0]?.emailAddress ?? null
}

export function canUserAccessAdmin(
    user: Pick<AppUser, 'email' | 'role'>,
    options: { currentAuthEmail?: string | null } = {},
): boolean {
    if (hasConfiguredAdminEmails()) {
        const effectiveEmail = options.currentAuthEmail ?? user.email
        return isAdminEmail(effectiveEmail)
    }

    return user.role === 'ADMIN'
}

/**
 * App User type - represents the Prisma User with fields we commonly need
 */
export interface AppUser {
    id: string
    clerkUserId: string
    email: string
    name: string | null
    displayName: string | null
    selectedIcon: string | null
    avatarBackground: string | null
    role: UserRole
    image: string | null
    lastOnlineAt?: Date | null
    lastSeenPath?: string | null
    // Tour state
    hasSeenTour: boolean
    tourCompleted: boolean
    tourDismissed: boolean
    tourDismissedAt: Date | null
}

/**
 * Get the current Clerk user ID from the auth context
 * Returns null if not authenticated
 */
export async function getClerkUserId(): Promise<string | null> {
    try {
        const { userId } = await auth()
        return userId
    } catch {
        return null
    }
}

/**
 * Get the current Clerk user object
 * Returns null if not authenticated
 */
export async function getClerkUser() {
    try {
        return await currentUser()
    } catch {
        return null
    }
}

/**
 * Sync a Clerk user to our Prisma database using upsert to handle race conditions.
 * Creates the user if they don't exist, or updates the clerkUserId if they do.
 * Returns the Prisma User record.
 */
export async function syncClerkUserToPrisma(clerkUserId: string): Promise<AppUser | null> {
    const clerkUser = await currentUser()
    
    if (!clerkUser) {
        return null
    }
    
    const email = clerkUser.emailAddresses[0]?.emailAddress
    if (!email) {
        console.error('Clerk user has no email address')
        return null
    }
    
    // Determine role based on ADMIN_EMAILS
    const role: UserRole = isAdminEmail(email) ? 'ADMIN' : 'USER'
    const syncRoleFromConfig = hasConfiguredAdminEmails()
    
    // Get Clerk user's name
    const clerkName = clerkUser.firstName 
        ? `${clerkUser.firstName}${clerkUser.lastName ? ' ' + clerkUser.lastName : ''}`
        : email.split('@')[0]
    
    // Generate a unique display name for new users
    // Note: We only generate if creating a new user, so no excludeUserId needed
    const nameResult = await generateUniqueDisplayName(prisma, { maxAttempts: 50 })
    let displayName: string
    if (!nameResult.success) {
        // Fallback to a simple generated name if uniqueness check fails
        // This should be extremely rare, but we want graceful degradation
        console.error('Failed to generate unique display name during user creation, using fallback')
        const { generateRandomDisplayName } = await import('./display-name')
        displayName = generateRandomDisplayName()
    } else {
        displayName = nameResult.displayName
    }
    
    try {
        // First, try to find by clerkUserId (most specific)
        let user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: {
                id: true,
                clerkUserId: true,
                email: true,
                name: true,
                displayName: true,
                selectedIcon: true,
                avatarBackground: true,
                role: true,
                image: true,
                lastOnlineAt: true,
                lastSeenPath: true,
                hasSeenTour: true,
                tourCompleted: true,
                tourDismissed: true,
                tourDismissedAt: true,
            }
        })
        
        if (user) {
            // User found by clerkUserId - update if needed
            const updates: Record<string, unknown> = {}

            if (email !== user.email) {
                updates.email = email
            }
            if (clerkName && clerkName !== user.name) {
                updates.name = clerkName
            }
            if (clerkUser.imageUrl && clerkUser.imageUrl !== user.image) {
                updates.image = clerkUser.imageUrl
            }
            if (syncRoleFromConfig && user.role !== role) {
                updates.role = role
                console.log(`[Admin Sync] Updated ${email} role to ${role} based on ADMIN_EMAILS config`)
            }
            
            if (Object.keys(updates).length > 0) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: updates
                })
            }
            
            return toAppUser(user)
        }
        
        // Not found by clerkUserId - try to find by email (for existing users migrating to Clerk)
        user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                clerkUserId: true,
                email: true,
                name: true,
                displayName: true,
                selectedIcon: true,
                avatarBackground: true,
                role: true,
                image: true,
                lastOnlineAt: true,
                lastSeenPath: true,
                hasSeenTour: true,
                tourCompleted: true,
                tourDismissed: true,
                tourDismissedAt: true,
            }
        })
        
        if (user) {
            // User exists by email but doesn't have clerkUserId - link them
            const updates: Record<string, unknown> = { clerkUserId }

            if (email !== user.email) {
                updates.email = email
            }
            if (clerkName && clerkName !== user.name) {
                updates.name = clerkName
            }
            if (clerkUser.imageUrl && clerkUser.imageUrl !== user.image) {
                updates.image = clerkUser.imageUrl
            }
            if (syncRoleFromConfig && user.role !== role) {
                updates.role = role
                console.log(`[Admin Sync] Updated ${email} role to ${role} based on ADMIN_EMAILS config`)
            }
            
            user = await prisma.user.update({
                where: { id: user.id },
                data: updates
            })
            
            console.log(`Linked existing user ${email} to Clerk ID ${clerkUserId}`)
            return toAppUser(user)
        }
        
        // User doesn't exist - create them
        user = await prisma.user.create({
            data: {
                clerkUserId,
                email,
                name: clerkName,
                displayName,
                image: clerkUser.imageUrl || null,
                role,
            }
        })
        
        console.log(`Created new user: ${email} with display name "${displayName}"`)
        if (role === 'ADMIN') {
            console.log(`Auto-assigned ADMIN role to ${email} based on ADMIN_EMAILS config`)
        }
        
        return toAppUser(user)
    } catch (error: unknown) {
        // Handle race condition - if we get a unique constraint error, 
        // the user was created by another request, so just fetch them
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            console.log(`Race condition detected for ${email}, fetching existing user`)
            const user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { clerkUserId },
                        { email }
                    ]
                }
            })
            
            if (user) {
                // Make sure clerkUserId is set
                if (!user.clerkUserId) {
                    const updated = await prisma.user.update({
                        where: { id: user.id },
                        data: { clerkUserId }
                    })
                    return toAppUser(updated)
                }
                return toAppUser(user)
            }
        }
        
        // Re-throw other errors
        throw error
    }
}

/**
 * Convert a Prisma User to AppUser
 */
function toAppUser(user: {
    id: string
    clerkUserId: string | null
    email: string | null
    name: string | null
    displayName: string | null
    selectedIcon: string | null
    avatarBackground: string | null
    role: UserRole
    image: string | null
    lastOnlineAt?: Date | null
    lastSeenPath?: string | null
    hasSeenTour: boolean
    tourCompleted: boolean
    tourDismissed: boolean
    tourDismissedAt: Date | null
}): AppUser {
    return {
        id: user.id,
        clerkUserId: user.clerkUserId!,
        email: user.email!,
        name: user.name,
        displayName: user.displayName,
        selectedIcon: user.selectedIcon,
        avatarBackground: user.avatarBackground,
        role: user.role,
        image: user.image,
        lastOnlineAt: user.lastOnlineAt,
        lastSeenPath: user.lastSeenPath,
        hasSeenTour: user.hasSeenTour,
        tourCompleted: user.tourCompleted,
        tourDismissed: user.tourDismissed,
        tourDismissedAt: user.tourDismissedAt,
    }
}

/**
 * Get the current app user (Prisma User synced from Clerk)
 * This is the main function to use in server components and API routes
 * Returns null if not authenticated
 */
export async function getAppUser(): Promise<AppUser | null> {
    const clerkUserId = await getClerkUserId()
    
    if (!clerkUserId) {
        return null
    }
    
    // Try to find user by Clerk ID first
    const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: {
            id: true,
            clerkUserId: true,
            email: true,
            name: true,
            displayName: true,
            selectedIcon: true,
            avatarBackground: true,
            role: true,
            image: true,
            lastOnlineAt: true,
            lastSeenPath: true,
            hasSeenTour: true,
            tourCompleted: true,
            tourDismissed: true,
            tourDismissedAt: true,
        }
    })
    
    if (user) {
        return toAppUser(user)
    }
    
    // User not found by Clerk ID - sync them
    return syncClerkUserToPrisma(clerkUserId)
}

/**
 * Get the current app user ID
 * Returns null if not authenticated
 */
export async function getAppUserId(): Promise<string | null> {
    const user = await getAppUser()
    return user?.id || null
}

/**
 * Check if the current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
    const user = await getAppUser()
    if (!user) {
        return false
    }

    const currentAuthEmail = await getCurrentClerkPrimaryEmail()
    return canUserAccessAdmin(user, { currentAuthEmail })
}

/**
 * Require authentication - throws if not authenticated
 * Returns the app user
 */
export async function requireAuth(): Promise<AppUser> {
    const user = await getAppUser()
    
    if (!user) {
        throw new Error('Unauthorized')
    }
    
    return user
}

/**
 * Require admin role - throws if not admin
 * Returns the app user
 */
export async function requireAdmin(): Promise<AppUser> {
    const user = await requireAuth()

    const currentAuthEmail = await getCurrentClerkPrimaryEmail()
    if (!canUserAccessAdmin(user, { currentAuthEmail })) {
        throw new Error('Forbidden: Admin access required')
    }

    return user
}

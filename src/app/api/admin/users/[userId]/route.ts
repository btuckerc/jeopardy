import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/clerk-auth'
import { jsonResponse, serverErrorResponse, notFoundResponse, badRequestResponse } from '@/lib/api-utils'
import { generateUniqueDisplayName, validateDisplayName } from '@/lib/display-name'

/**
 * DELETE /api/admin/users/[userId]
 * Delete a user and all their related data from Prisma
 * Note: This does NOT delete the Clerk account, only Prisma data
 * Admin only
 */
export async function DELETE(
    request: Request,
    { params }: { params: { userId: string } }
) {
    try {
        await requireAdmin()

        const { userId } = params

        // Verify user exists
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
        })

        if (!user) {
            return notFoundResponse('User not found')
        }

        // Delete related data in the correct order to satisfy foreign key constraints
        // Order matters: delete child records before parent records

        // 1. Delete game-related data
        const userGames = await prisma.game.findMany({
            where: { userId },
            select: { id: true },
        })
        const gameIds = userGames.map(g => g.id)

        if (gameIds.length > 0) {
            // Delete game questions
            await prisma.gameQuestion.deleteMany({
                where: { gameId: { in: gameIds } },
            })
            // Delete games
            await prisma.game.deleteMany({
                where: { id: { in: gameIds } },
            })
        }

        // 2. Delete game history
        await prisma.gameHistory.deleteMany({
            where: { userId },
        })

        // 3. Delete user progress
        await prisma.userProgress.deleteMany({
            where: { userId },
        })

        // 4. Delete daily challenge completions
        await prisma.userDailyChallenge.deleteMany({
            where: { userId },
        })

        // 5. Delete user achievements
        await prisma.userAchievement.deleteMany({
            where: { userId },
        })

        // 6. Delete disputes created by user
        await prisma.answerDispute.deleteMany({
            where: { userId },
        })

        // 7. Delete disputes resolved by user (as admin)
        await prisma.answerDispute.updateMany({
            where: { adminId: userId },
            data: { adminId: null }, // Set to null instead of deleting disputes
        })

        // 8. Delete answer overrides created by user
        await prisma.answerOverride.deleteMany({
            where: { createdByUserId: userId },
        })

        // 9. Update guest sessions claimed by user
        await prisma.guestSession.updateMany({
            where: { claimedByUserId: userId },
            data: { claimedByUserId: null }, // Set to null instead of deleting sessions
        })

        // 10. Delete NextAuth accounts and sessions (if they exist)
        await prisma.account.deleteMany({
            where: { userId },
        })
        await prisma.session.deleteMany({
            where: { userId },
        })

        // 11. Finally, delete the user
        await prisma.user.delete({
            where: { id: userId },
        })

        return jsonResponse({
            success: true,
            message: 'User and all related data deleted successfully',
        })
    } catch (error) {
        return serverErrorResponse('Failed to delete user', error)
    }
}

/**
 * PATCH /api/admin/users/[userId]
 * Update a user's display name (reset or edit)
 * Admin only
 */
export async function PATCH(
    request: Request,
    { params }: { params: { userId: string } }
) {
    try {
        await requireAdmin()

        const { userId } = params
        const body = await request.json()
        const { action, displayName } = body

        if (!action || !['reset', 'edit'].includes(action)) {
            return badRequestResponse('action must be "reset" or "edit"')
        }

        if (action === 'edit' && (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0)) {
            return badRequestResponse('displayName is required for edit action')
        }

        // Verify user exists
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, displayName: true },
        })

        if (!user) {
            return notFoundResponse('User not found')
        }

        // Update display name
        let newDisplayName: string
        if (action === 'reset') {
            // Generate a unique display name using the centralized helper
            const nameResult = await generateUniqueDisplayName(prisma, {
                excludeUserId: userId,
                maxAttempts: 50
            })
            
            if (!nameResult.success) {
                return serverErrorResponse(
                    `Failed to generate a valid unique display name after ${nameResult.attempts} attempts. ${nameResult.error}`
                )
            }
            
            newDisplayName = nameResult.displayName
        } else {
            // Validate the provided display name
            const validation = validateDisplayName(displayName)
            if (!validation.ok) {
                return badRequestResponse(validation.message)
            }
            
            // Check for uniqueness (case-insensitive, excluding current user)
            const normalized = validation.normalized
            const existingUser = await prisma.user.findFirst({
                where: {
                    id: { not: userId },
                    displayName: {
                        equals: normalized,
                        mode: 'insensitive'
                    }
                },
                select: { id: true }
            })
            
            if (existingUser) {
                return badRequestResponse('That display name is already taken. Please choose another.')
            }
            
            newDisplayName = normalized
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { displayName: newDisplayName },
            select: { id: true, displayName: true, email: true },
        })

        return jsonResponse({
            success: true,
            message: action === 'reset' 
                ? `Display name reset to "${newDisplayName}"`
                : `Display name updated to "${newDisplayName}"`,
            user: updatedUser,
        })
    } catch (error) {
        return serverErrorResponse('Failed to update display name', error)
    }
}


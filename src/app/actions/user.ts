'use server'

import { prisma } from '@/lib/prisma'

export async function resetUserHistory(userId: string) {
    try {
        await prisma.$transaction([
            // Delete all game history for the user
            prisma.gameHistory.deleteMany({
                where: { userId }
            }),
            // Reset all progress for the user
            prisma.userProgress.deleteMany({
                where: { userId }
            })
        ])

        return { success: true }
    } catch (error) {
        console.error('Error resetting user history:', error)
        throw error
    }
} 
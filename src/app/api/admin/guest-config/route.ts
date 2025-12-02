import { prisma } from '@/lib/prisma'
import { jsonResponse, serverErrorResponse, requireAdmin, parseBody } from '@/lib/api-utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateConfigSchema = z.object({
    randomGameMaxQuestionsBeforeAuth: z.number().int().min(0).optional(),
    randomGameMaxCategoriesBeforeAuth: z.number().int().min(0).nullable().optional(),
    randomGameMaxRoundsBeforeAuth: z.number().int().min(0).nullable().optional(),
    randomGameMaxGamesBeforeAuth: z.number().int().min(0).optional(),
    randomQuestionMaxQuestionsBeforeAuth: z.number().int().min(0).optional(),
    randomQuestionMaxCategoriesBeforeAuth: z.number().int().min(0).nullable().optional(),
    dailyChallengeGuestEnabled: z.boolean().optional(),
    dailyChallengeGuestAppearsOnLeaderboard: z.boolean().optional(),
    dailyChallengeMinLookbackDays: z.number().int().min(30).max(1825).optional(), // 30 days to 5 years
    dailyChallengeSeasons: z.array(z.number().int().min(1)).nullable().optional(), // Array of season numbers
    timeToAuthenticateMinutes: z.number().int().min(1).optional()
})

/**
 * GET /api/admin/guest-config
 * Get current guest configuration
 */
export async function GET() {
    try {
        const { error: authError } = await requireAdmin()
        if (authError) return authError

        let config = await prisma.guestConfig.findFirst()

        if (!config) {
            // Create default if it doesn't exist
            config = await prisma.guestConfig.create({
                data: {
                    id: 'default',
                    randomGameMaxQuestionsBeforeAuth: 1,
                    randomGameMaxCategoriesBeforeAuth: null,
                    randomGameMaxRoundsBeforeAuth: null,
                    randomGameMaxGamesBeforeAuth: 0,
                    randomQuestionMaxQuestionsBeforeAuth: 1,
                    randomQuestionMaxCategoriesBeforeAuth: null,
                    dailyChallengeGuestEnabled: false,
                    dailyChallengeGuestAppearsOnLeaderboard: false,
                    dailyChallengeMinLookbackDays: 365, // Default 1 year
                    dailyChallengeSeasons: null, // Default: auto-calculate from 1-3 years ago
                    timeToAuthenticateMinutes: 1440
                }
            })
        }

        return jsonResponse(config)
    } catch (error) {
        return serverErrorResponse('Error fetching guest config', error)
    }
}

/**
 * PUT /api/admin/guest-config
 * Update guest configuration
 */
export async function PUT(request: Request) {
    try {
        const { error: authError } = await requireAdmin()
        if (authError) return authError

        const { data: body, error } = await parseBody(request, updateConfigSchema)
        if (error) return error

        // Get or create config
        let config = await prisma.guestConfig.findFirst()

        if (!config) {
            config = await prisma.guestConfig.create({
                data: {
                    id: 'default',
                    ...body
                }
            })
        } else {
            config = await prisma.guestConfig.update({
                where: { id: config.id },
                data: body
            })
        }

        return jsonResponse(config)
    } catch (error) {
        return serverErrorResponse('Error updating guest config', error)
    }
}


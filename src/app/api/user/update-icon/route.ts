import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse, parseBody } from '@/lib/api-utils'
import { VALID_EMOJIS, VALID_BACKGROUNDS, type AvatarBackgroundKey } from '@/lib/avatar'
import { z } from 'zod'

const iconSchema = z.object({
    icon: z.string().nullable().optional(),
    avatarBackground: z.string().nullable().optional()
})

export async function POST(request: Request) {
    const appUser = await getAppUser()

    if (!appUser) {
        return unauthorizedResponse()
    }

    try {
        const { data: body, error } = await parseBody(request, iconSchema)
        if (error) return error

        // Validate icon if provided and not null
        if (body.icon !== undefined && body.icon !== null) {
            if (!VALID_EMOJIS.has(body.icon)) {
                return jsonResponse(
                    { error: 'Invalid icon. Please select from the available options.' },
                    { status: 400 }
                )
            }
        }

        // Validate avatarBackground if provided and not null
        if (body.avatarBackground !== undefined && body.avatarBackground !== null) {
            if (!VALID_BACKGROUNDS.has(body.avatarBackground as AvatarBackgroundKey)) {
                return jsonResponse(
                    { error: 'Invalid avatar background. Please select from the available options.' },
                    { status: 400 }
                )
            }
        }

        // Build update data - only include fields that were provided
        const updateData: { selectedIcon?: string | null; avatarBackground?: string | null } = {}
        if (body.icon !== undefined) {
            updateData.selectedIcon = body.icon
        }
        if (body.avatarBackground !== undefined) {
            updateData.avatarBackground = body.avatarBackground
        }

        const user = await prisma.user.update({
            where: { id: appUser.id },
            data: updateData,
            select: { 
                selectedIcon: true,
                avatarBackground: true
            }
        })

        return jsonResponse({ 
            selectedIcon: user.selectedIcon,
            avatarBackground: user.avatarBackground
        })
    } catch (error) {
        return serverErrorResponse('Failed to update icon', error)
    }
}

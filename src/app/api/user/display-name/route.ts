import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import {
    jsonResponse,
    unauthorizedResponse,
    badRequestResponse,
    serverErrorResponse
} from '@/lib/api-utils'
import { generateRandomDisplayName } from '@/lib/display-name'

export async function GET() {
    const appUser = await getAppUser()

    if (!appUser) {
        return unauthorizedResponse()
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: appUser.id },
            select: {
                displayName: true,
                selectedIcon: true,
                avatarBackground: true
            }
        })

        return jsonResponse({
            displayName: user?.displayName || appUser.displayName || generateRandomDisplayName(),
            selectedIcon: user?.selectedIcon || '👤',
            avatarBackground: user?.avatarBackground || null
        })
    } catch (error) {
        return serverErrorResponse('Failed to fetch display name', error)
    }
}

export async function POST(request: Request) {
    const appUser = await getAppUser()

    if (!appUser) {
        return unauthorizedResponse()
    }

    try {
        const { displayName, selectedIcon, avatarBackground } = await request.json()

        if (displayName && typeof displayName !== 'string') {
            return badRequestResponse('Display name must be a string')
        }

        if (displayName && (displayName.length < 3 || displayName.length > 20)) {
            return badRequestResponse('Display name must be between 3 and 20 characters')
        }

        const user = await prisma.user.update({
            where: { id: appUser.id },
            data: {
                displayName: displayName || undefined,
                selectedIcon: selectedIcon === null ? null : selectedIcon || undefined,
                avatarBackground: avatarBackground === null ? null : avatarBackground || undefined
            },
            select: {
                displayName: true,
                selectedIcon: true,
                avatarBackground: true
            }
        })

        return jsonResponse(user)
    } catch (error) {
        return serverErrorResponse('Failed to update user data', error)
    }
} 
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import {
    jsonResponse,
    unauthorizedResponse,
    badRequestResponse,
    serverErrorResponse
} from '@/lib/api-utils'
import { generateRandomDisplayName, validateDisplayName, normalizeDisplayName } from '@/lib/display-name'

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

        // Validate display name if provided
        if (displayName !== undefined && displayName !== null) {
            if (typeof displayName !== 'string') {
                return badRequestResponse('Display name must be a string')
            }

            // Validate using shared validation function
            const validation = validateDisplayName(displayName)
            if (!validation.ok) {
                return badRequestResponse(validation.message)
            }

            // Check for uniqueness (case-insensitive, trimmed)
            const normalized = validation.normalized
            const existingUser = await prisma.user.findFirst({
                where: {
                    id: { not: appUser.id },
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

            // Update with normalized display name
            const user = await prisma.user.update({
                where: { id: appUser.id },
                data: {
                    displayName: normalized,
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
        } else {
            // Only updating icon or avatar background, not display name
            const user = await prisma.user.update({
                where: { id: appUser.id },
                data: {
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
        }
    } catch (error) {
        return serverErrorResponse('Failed to update user data', error)
    }
} 
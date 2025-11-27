import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import {
    jsonResponse,
    unauthorizedResponse,
    badRequestResponse,
    serverErrorResponse
} from '@/lib/api-utils'

// Function to generate a random display name
function generateRandomDisplayName(): string {
    const adjectives = ['Quick', 'Clever', 'Bright', 'Sharp', 'Smart', 'Witty', 'Wise', 'Bold', 'Eager', 'Grand']
    const nouns = ['Scholar', 'Thinker', 'Master', 'Champion', 'Expert', 'Genius', 'Sage', 'Mind', 'Brain', 'Ace']

    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)]
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)]

    return `${randomAdjective}${randomNoun}`
}

export async function GET() {
    const session = await auth()

    if (!session?.user?.id) {
        return unauthorizedResponse()
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                displayName: true,
                selectedIcon: true,
                avatarBackground: true
            }
        })

        return jsonResponse({
            displayName: user?.displayName || session.user.displayName || generateRandomDisplayName(),
            selectedIcon: user?.selectedIcon || '👤',
            avatarBackground: user?.avatarBackground || null
        })
    } catch (error) {
        return serverErrorResponse('Failed to fetch display name', error)
    }
}

export async function POST(request: Request) {
    const session = await auth()

    if (!session?.user?.id) {
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
            where: { id: session.user.id },
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
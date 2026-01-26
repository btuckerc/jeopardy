import { getResumableGames, type ResumableGame } from '@/lib/resumable-games'
import { getAppUser } from '@/lib/clerk-auth'
import { prisma } from '@/lib/prisma'
import GameHubClient from './GameHubClient'

// Convert Date objects to strings for client component serialization
function serializeResumableGames(games: ResumableGame[]) {
    return games.map(game => ({
        ...game,
        createdAt: game.createdAt.toISOString(),
        updatedAt: game.updatedAt.toISOString()
    }))
}

export default async function GameHubPage() {
    // Fetch user and spoiler settings in parallel with resumable games
    const appUser = await getAppUser()
    
    // Fetch resumable games and spoiler settings in parallel
    const [resumableGames, spoilerSettings] = await Promise.all([
        appUser ? getResumableGames() : Promise.resolve([]),
        appUser ? prisma.user.findUnique({
            where: { id: appUser.id },
            select: {
                spoilerBlockDate: true,
                spoilerBlockEnabled: true
            }
        }) : Promise.resolve(null)
    ])
    
    // Serialize dates for client component
    const serializedGames = serializeResumableGames(resumableGames)
    
    // Pass user info so client doesn't need to fetch it
    const initialUser = appUser ? {
        id: appUser.id,
        email: appUser.email,
        displayName: appUser.displayName,
        selectedIcon: appUser.selectedIcon,
        avatarBackground: appUser.avatarBackground,
        role: appUser.role,
    } : null
    
    // Serialize spoiler settings
    const serializedSpoilerSettings = spoilerSettings ? {
        enabled: spoilerSettings.spoilerBlockEnabled ?? false,
        cutoffDate: spoilerSettings.spoilerBlockDate?.toISOString() ?? null
    } : null

    return (
        <GameHubClient 
            initialResumableGames={serializedGames}
            initialUser={initialUser}
            initialSpoilerSettings={serializedSpoilerSettings}
        />
    )
}

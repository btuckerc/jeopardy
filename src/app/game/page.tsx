import { getResumableGames, type ResumableGame } from '@/lib/resumable-games'
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
    // Fetch resumable games on the server
    const resumableGames = await getResumableGames()
    // Serialize dates for client component
    const serializedGames = serializeResumableGames(resumableGames)

    return <GameHubClient initialResumableGames={serializedGames} />
}

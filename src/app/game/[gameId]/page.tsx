import { notFound, redirect } from 'next/navigation'
import { getGameData } from '@/lib/game-data'
import GameBoardClient from './GameBoardClient'

interface PageProps {
    params: Promise<{ gameId: string }>
}

export default async function GameBoardPage({ params }: PageProps) {
    const { gameId } = await params

    try {
        const gameData = await getGameData(gameId)
        return <GameBoardClient initialGameData={gameData} />
        } catch (error) {
        if (error instanceof Error) {
            if (error.message === 'Unauthorized') {
                redirect('/sign-in?redirect_url=' + encodeURIComponent(`/game/${gameId}`))
            }
            if (error.message === 'Game not found' || error.message === 'You do not have access to this game') {
                notFound()
            }
        }
        throw error
    }
}

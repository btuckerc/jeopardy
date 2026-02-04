import { notFound, redirect } from 'next/navigation'
import { Metadata } from 'next'
import { getGameData } from '@/lib/game-data'
import GameBoardClient from './GameBoardClient'

interface PageProps {
    params: Promise<{ gameId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { gameId } = await params
    
    try {
        const gameData = await getGameData(gameId)
        
        // Extract category names from game questions
        const categoryNames = Object.values(gameData.questions)
            .map(q => q.categoryName)
            .filter((name, index, arr) => arr.indexOf(name) === index) // unique
            .slice(0, 3) // first 3 categories
            .join(', ')
        
        const title = categoryNames 
            ? `Jeopardy Game: ${categoryNames} - trivrdy`
            : 'Jeopardy Game Board - trivrdy'
        
        return {
            title,
            description: `Play this Jeopardy game with ${gameData.stats.totalQuestions} questions. Current score: ${gameData.currentScore}. Test your trivia knowledge!`,
            robots: {
                index: false, // Don't index individual game boards
                follow: true,
            },
            openGraph: {
                title,
                description: `Play this Jeopardy game with ${gameData.stats.totalQuestions} questions.`,
                type: 'website',
            },
        }
    } catch {
        // Return default metadata if game not found
        return {
            title: 'Jeopardy Game - trivrdy',
            robots: {
                index: false,
                follow: true,
            },
        }
    }
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

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import GameBoard from '@/components/GameBoard'

export default async function PlayPage() {
    const session = await getServerSession()
    if (!session?.user?.email) {
        redirect('/api/auth/signin')
    }

    // Get user
    const user = await prisma.user.findUnique({
        where: { email: session.user.email }
    })

    if (!user) {
        redirect('/api/auth/signin')
    }

    // Check for active game
    const activeGame = await prisma.game.findFirst({
        where: {
            userId: user.id,
            completed: false
        },
        include: {
            questions: {
                include: {
                    question: {
                        include: {
                            category: true
                        }
                    }
                }
            }
        }
    })

    if (activeGame) {
        return <GameBoard game={activeGame} />
    }

    // Get all categories (both original and knowledge)
    const categories = await prisma.category.findMany({
        include: {
            questions: true
        }
    })

    // Get questions grouped by knowledge category
    const knowledgeCategories = await prisma.question.groupBy({
        by: ['knowledgeCategory'],
        _count: true
    })

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-8">Start New Game</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Classic Mode */}
                <div className="bg-blue-100 p-6 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold mb-4">Classic Mode</h2>
                    <p className="mb-4">Play with original Jeopardy! categories as shown in the TV show.</p>
                    <p className="mb-4 text-sm">Available categories: {categories.length}</p>
                    <form action="/api/games/create" method="POST">
                        <input type="hidden" name="useKnowledgeCategories" value="false" />
                        <button
                            type="submit"
                            className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 transition-colors"
                        >
                            Start Classic Game
                        </button>
                    </form>
                </div>

                {/* Knowledge Mode */}
                <div className="bg-purple-100 p-6 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold mb-4">Knowledge Mode</h2>
                    <p className="mb-4">Play with questions organized by knowledge categories.</p>
                    <p className="mb-4 text-sm">Available categories: {knowledgeCategories.length}</p>
                    <form action="/api/games/create" method="POST">
                        <input type="hidden" name="useKnowledgeCategories" value="true" />
                        <button
                            type="submit"
                            className="bg-purple-500 text-white px-6 py-2 rounded hover:bg-purple-600 transition-colors"
                        >
                            Start Knowledge Game
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
} 
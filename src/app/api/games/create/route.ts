import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
    const session = await getServerSession()
    if (!session?.user?.email) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
        const formData = await request.formData()
        const useKnowledgeCategories = formData.get('useKnowledgeCategories') === 'true'

        // Get user
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        })

        if (!user) {
            return new NextResponse('User not found', { status: 404 })
        }

        // Get questions based on mode
        let questions
        if (useKnowledgeCategories) {
            // Get questions grouped by knowledge category
            const categories = await prisma.question.groupBy({
                by: ['knowledgeCategory'],
            })

            // Randomly select 5 knowledge categories
            const selectedCategories = categories
                .sort(() => Math.random() - 0.5)
                .slice(0, 5)
                .map(c => c.knowledgeCategory)

            // Get questions for selected categories
            questions = await prisma.question.findMany({
                where: {
                    knowledgeCategory: {
                        in: selectedCategories
                    }
                },
                include: {
                    category: true
                }
            })
        } else {
            // Get all categories
            const categories = await prisma.category.findMany()

            // Randomly select 5 categories
            const selectedCategories = categories
                .sort(() => Math.random() - 0.5)
                .slice(0, 5)
                .map(c => c.id)

            // Get questions for selected categories
            questions = await prisma.question.findMany({
                where: {
                    categoryId: {
                        in: selectedCategories
                    }
                },
                include: {
                    category: true
                }
            })
        }

        // Create new game
        const game = await prisma.game.create({
            data: {
                userId: user.id,
                useKnowledgeCategories,
                questions: {
                    create: questions.map(q => ({
                        questionId: q.id,
                        answered: false
                    }))
                }
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

        return NextResponse.json({ gameId: game.id })
    } catch (error) {
        console.error('Error creating game:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
} 
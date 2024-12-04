import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const categoryName = searchParams.get('name')

    if (!categoryName) {
        return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    try {
        // Get the authenticated user
        const supabase = createRouteHandlerClient({ cookies })
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get the category's questions with their game history
        const category = await prisma.category.findUnique({
            where: { name: categoryName },
            include: {
                questions: {
                    orderBy: {
                        value: 'asc'
                    },
                    include: {
                        gameHistory: {
                            where: {
                                userId: session.user.id,
                                correct: true
                            },
                            orderBy: { timestamp: 'desc' },
                            take: 1
                        }
                    }
                }
            }
        })

        if (!category) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 })
        }

        // Format all questions, but only include content for correctly answered ones
        const questions = category.questions.map(question => {
            const isCorrect = question.gameHistory.length > 0
            return {
                id: question.id,
                question: isCorrect ? question.question : null,
                answer: isCorrect ? question.answer : null,
                value: question.value,
                airDate: question.airDate,
                correct: isCorrect
            }
        })

        return NextResponse.json({
            questions,
            totalQuestions: category.questions.length,
            correctQuestions: questions.filter(q => q.correct).length
        })
    } catch (error) {
        console.error('Error fetching category details:', error)
        return NextResponse.json(
            { error: 'Failed to fetch category details' },
            { status: 500 }
        )
    }
} 
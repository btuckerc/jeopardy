import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Category, Question, Prisma } from '@prisma/client'

type KnowledgeCategory =
    | 'GEOGRAPHY_AND_HISTORY'
    | 'ENTERTAINMENT'
    | 'ARTS_AND_LITERATURE'
    | 'SCIENCE_AND_NATURE'
    | 'SPORTS_AND_LEISURE'
    | 'GENERAL_KNOWLEDGE'

type CategoryWithQuestions = Category & {
    _count: {
        questions: number
    }
    questions: {
        airDate: Date | null
    }[]
}

type QuestionResult = Pick<Question, 'id' | 'question' | 'answer' | 'value' | 'isDoubleJeopardy' | 'wasTripleStumper'>

export async function GET(request: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        const { data: { session } } = await supabase.auth.getSession()
        const userId = session?.user?.id

        const searchParams = request.nextUrl.searchParams
        const mode = searchParams.get('mode')
        const isDouble = searchParams.get('isDouble') === 'true'

        // Get user's spoiler settings if logged in
        const user = userId ? await prisma.user.findUnique({
            where: { id: userId },
            select: {
                spoilerBlockDate: true,
                spoilerBlockEnabled: true
            }
        }) : null

        // Base query
        const baseWhere: Prisma.CategoryWhereInput = {
            questions: {
                some: {
                    isDoubleJeopardy: isDouble,
                    ...(user?.spoilerBlockEnabled ? {
                        airDate: {
                            lt: user.spoilerBlockDate ?? undefined
                        }
                    } : {})
                }
            }
        }

        // Add mode-specific filters
        let whereClause: Prisma.CategoryWhereInput = { ...baseWhere }

        switch (mode) {
            case 'knowledge': {
                const categories = searchParams.get('categories')?.split(',') || []
                if (categories.length > 0) {
                    whereClause = {
                        AND: [
                            baseWhere,
                            {
                                questions: {
                                    some: {
                                        knowledgeCategory: {
                                            in: categories as KnowledgeCategory[]
                                        }
                                    }
                                }
                            }
                        ]
                    }
                }
                break
            }

            case 'custom': {
                const categoryIds = searchParams.get('categoryIds')?.split(',') || []
                if (categoryIds.length > 0) {
                    whereClause = {
                        AND: [
                            baseWhere,
                            { id: { in: categoryIds } }
                        ]
                    }
                }
                break
            }

            case 'date': {
                const date = searchParams.get('date')
                if (date) {
                    whereClause = {
                        AND: [
                            baseWhere,
                            {
                                questions: {
                                    some: {
                                        airDate: new Date(date)
                                    }
                                }
                            }
                        ]
                    }
                }
                break
            }
        }

        // Get categories with their question counts
        const categoriesWithCounts = await prisma.category.findMany({
            where: whereClause,
            include: {
                questions: {
                    where: {
                        isDoubleJeopardy: isDouble,
                        ...(user?.spoilerBlockEnabled ? {
                            airDate: {
                                lt: user.spoilerBlockDate ?? undefined
                            }
                        } : {})
                    },
                    select: {
                        airDate: true
                    }
                },
                _count: {
                    select: {
                        questions: {
                            where: {
                                isDoubleJeopardy: isDouble,
                                ...(user?.spoilerBlockEnabled ? {
                                    airDate: {
                                        lt: user.spoilerBlockDate ?? undefined
                                    }
                                } : {})
                            }
                        }
                    }
                }
            }
        }) as unknown as CategoryWithQuestions[]

        // Filter to categories that have exactly 5 questions on at least one airdate
        const eligibleCategories = categoriesWithCounts.filter((category: CategoryWithQuestions) => {
            // Group questions by airdate
            const questionsByDate = category.questions.reduce((acc: Record<string, number>, q) => {
                const date = q.airDate?.toISOString().split('T')[0] ?? 'unknown'
                acc[date] = (acc[date] || 0) + 1
                return acc
            }, {})

            // Check if any date has exactly 5 questions
            return Object.values(questionsByDate).some(count => count === 5)
        })

        if (eligibleCategories.length < 5) {
            return NextResponse.json(
                { error: 'Not enough eligible categories found' },
                { status: 404 }
            )
        }

        // Select categories (all if custom mode, random 5 otherwise)
        const selectedCategories = mode === 'custom'
            ? eligibleCategories
            : eligibleCategories.sort(() => Math.random() - 0.5).slice(0, 5)

        // Get questions for each category
        const categoriesWithQuestions = await Promise.all(
            selectedCategories.map(async (category: CategoryWithQuestions) => {
            // Get all questions grouped by airdate
                const questions = await prisma.question.findMany({
                    where: {
                        categoryId: category.id,
                        isDoubleJeopardy: isDouble,
                        ...(user?.spoilerBlockEnabled ? {
                            airDate: {
                                lt: user.spoilerBlockDate ?? undefined
                            }
                        } : {})
                    },
                    orderBy: [
                        { airDate: 'desc' },
                        { value: 'asc' }
                    ],
                    select: {
                        id: true,
                        question: true,
                        answer: true,
                        value: true,
                        isDoubleJeopardy: true,
                        wasTripleStumper: true,
                        airDate: true
                    }
                })

                // Group questions by airdate
                const questionsByDate = questions.reduce((acc: Record<string, typeof questions>, q) => {
                    const date = q.airDate?.toISOString().split('T')[0] ?? 'unknown'
                    if (!acc[date]) acc[date] = []
                    acc[date].push(q)
                    return acc
                }, {})

                // Find the first date that has exactly 5 questions
                const validDate = Object.entries(questionsByDate)
                    .find(([_, questions]) => questions.length === 5)?.[0]

                if (!validDate) {
                    throw new Error(`No valid date found for category ${category.id}`)
                }

                // Return the 5 questions from that date
                const selectedQuestions = questionsByDate[validDate]
                    .sort((a, b) => a.value - b.value)
                    .map(({ airDate, ...q }) => q)

                return {
                    id: category.id,
                    name: category.name,
                    questions: selectedQuestions
                }
            })
        )

        return NextResponse.json(categoriesWithQuestions)
    } catch (error) {
        console.error('Error loading game categories:', error)
        return NextResponse.json(
            { error: 'Failed to load categories' },
            { status: 500 }
        )
    }
} 
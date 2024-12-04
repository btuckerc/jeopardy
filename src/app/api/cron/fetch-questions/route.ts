import { NextResponse } from 'next/server'
import { PrismaClient, KnowledgeCategory } from '@prisma/client'
import axios from 'axios'
import { subDays, format } from 'date-fns'
import * as cheerio from 'cheerio'

// Remove edge runtime since we need Node.js features
// export const runtime = 'edge'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

interface JeopardyQuestion {
    id: string
    question: string
    answer: string
    value: number
    categoryName: string
    difficulty: 'EASY' | 'MEDIUM' | 'HARD'
    knowledgeCategory: KnowledgeCategory
    airDate?: string
    season?: number
    episodeId?: string
    wasTripleStumper?: boolean
    isDoubleJeopardy?: boolean
}

function getDifficulty(value: number): 'EASY' | 'MEDIUM' | 'HARD' {
    if (value <= 400) return 'EASY'
    if (value <= 800) return 'MEDIUM'
    return 'HARD'
}

function getKnowledgeCategory(category: string): KnowledgeCategory {
    const categoryLower = category.toLowerCase()

    if (categoryLower.includes('history') || categoryLower.includes('geography') ||
        categoryLower.includes('world') || categoryLower.includes('capital') ||
        categoryLower.includes('president')) {
        return 'GEOGRAPHY_AND_HISTORY'
    }

    if (categoryLower.includes('movie') || categoryLower.includes('film') ||
        categoryLower.includes('tv') || categoryLower.includes('television') ||
        categoryLower.includes('actor') || categoryLower.includes('music') ||
        categoryLower.includes('song')) {
        return 'ENTERTAINMENT'
    }

    if (categoryLower.includes('art') || categoryLower.includes('literature') ||
        categoryLower.includes('book') || categoryLower.includes('author') ||
        categoryLower.includes('poet')) {
        return 'ARTS_AND_LITERATURE'
    }

    if (categoryLower.includes('science') || categoryLower.includes('nature') ||
        categoryLower.includes('animal') || categoryLower.includes('biology') ||
        categoryLower.includes('physics') || categoryLower.includes('chemistry')) {
        return 'SCIENCE_AND_NATURE'
    }

    if (categoryLower.includes('sport') || categoryLower.includes('game') ||
        categoryLower.includes('olympic') || categoryLower.includes('athlete') ||
        categoryLower.includes('team')) {
        return 'SPORTS_AND_LEISURE'
    }

    return 'GENERAL_KNOWLEDGE'
}

async function getYesterdayGame(): Promise<JeopardyQuestion[]> {
    const yesterday = subDays(new Date(), 1)
    const formattedDate = format(yesterday, 'yyyy-MM-dd')

    try {
        const searchUrl = `https://j-archive.com/search.php?query=&search_type=date&when_day=${format(yesterday, 'dd')}&when_month=${format(yesterday, 'MM')}&when_year=${format(yesterday, 'yyyy')}`
        const searchResponse = await axios.get(searchUrl)
        const $ = cheerio.load(searchResponse.data)

        const gameLink = $('a').filter((_, el) => $(el).text().includes(formattedDate)).first().attr('href')

        if (!gameLink) {
            console.log('No game found for yesterday')
            return []
        }

        const gameResponse = await axios.get(gameLink)
        const game$ = cheerio.load(gameResponse.data)

        const questions: JeopardyQuestion[] = []

        game$('.clue').each((_, clue) => {
            const $clue = game$(clue)
            const question = $clue.find('.clue_text').text().trim()
            const answer = $clue.find('.correct_response').text().trim()
            const value = parseInt($clue.find('.clue_value').text().replace('$', '').replace(',', '')) || 0
            const categoryName = $clue.closest('table').find('.category_name').text().trim()

            if (question && answer) {
                questions.push({
                    id: Math.random().toString(36).substring(7),
                    question,
                    answer,
                    value,
                    categoryName,
                    difficulty: getDifficulty(value),
                    knowledgeCategory: getKnowledgeCategory(categoryName),
                    airDate: formattedDate,
                    season: parseInt(gameLink.match(/game_id=(\d+)/)?.[1] || '0'),
                    episodeId: gameLink.split('id=')[1]
                })
            }
        })

        return questions
    } catch (error) {
        console.error('Error fetching yesterday\'s game:', error)
        return []
    }
}

export async function GET(request: Request) {
    try {
        // Verify cron secret to prevent unauthorized access
        const authHeader = request.headers.get('authorization')
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        const questions = await getYesterdayGame()

        if (questions.length === 0) {
            return NextResponse.json({
                success: false,
                message: 'No questions found for yesterday'
            })
        }

        // Initialize PrismaClient and save questions
        const prisma = new PrismaClient()

        try {
            await prisma.$transaction(async (tx) => {
                for (const question of questions) {
                    // First, get or create the category
                    const category = await tx.category.upsert({
                        where: { name: question.categoryName },
                        create: { name: question.categoryName },
                        update: {}
                    })

                    // Then create the question with the proper category relation
                    await tx.question.create({
                        data: {
                            id: question.id,
                            question: question.question,
                            answer: question.answer,
                            value: question.value,
                            difficulty: question.difficulty,
                            knowledgeCategory: question.knowledgeCategory,
                            airDate: question.airDate ? new Date(question.airDate) : undefined,
                            season: question.season,
                            episodeId: question.episodeId,
                            wasTripleStumper: question.wasTripleStumper,
                            isDoubleJeopardy: question.isDoubleJeopardy,
                            category: {
                                connect: {
                                    id: category.id
                                }
                            }
                        }
                    })
                }
            })

            await prisma.$disconnect()

            return NextResponse.json({
                success: true,
                message: `Successfully saved ${questions.length} questions`,
                questionCount: questions.length
            })
        } catch (error) {
            await prisma.$disconnect()
            throw error
        }
    } catch (error) {
        console.error('Error in cron job:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
} 
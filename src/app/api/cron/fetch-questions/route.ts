/**
 * Cron Job: Fetch Yesterday's Questions
 * 
 * Automatically fetches questions from yesterday's Jeopardy game and saves them to the database.
 * Uses the modular jarchive-scraper library for all parsing logic.
 */

import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { subDays, format } from 'date-fns'
import { parseGameByDate, JeopardyRound } from '@/lib/jarchive-scraper'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Maximum allowed duration for hobby plan (in seconds)

// Map string round to Prisma enum
function toPrismaRound(round: JeopardyRound): 'SINGLE' | 'DOUBLE' | 'FINAL' {
    return round
}

export async function GET(request: Request) {
    try {
        // Verify cron secret to prevent unauthorized access
        const authHeader = request.headers.get('authorization')
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        const yesterday = subDays(new Date(), 1)
        const formattedDate = format(yesterday, 'yyyy-MM-dd')

        console.log(`Fetching game for ${formattedDate}...`)

        // Use the modular scraper to fetch and parse the game
        const game = await parseGameByDate(formattedDate)

        if (!game || game.questions.length === 0) {
            return NextResponse.json({
                success: false,
                message: `No game found for ${formattedDate}`
            })
        }

        console.log(`Found ${game.questions.length} questions from game ${game.gameId}`)

        // Initialize PrismaClient and save questions
        const prisma = new PrismaClient()

        try {
            let savedCount = 0
            let skippedCount = 0

            await prisma.$transaction(async (tx) => {
                for (const question of game.questions) {
                    // First, get or create the category
                    const category = await tx.category.upsert({
                        where: { name: question.category },
                        create: { 
                            name: question.category,
                            knowledgeCategory: question.knowledgeCategory
                        },
                        update: {}
                    })

                    // Check if question already exists (avoid duplicates)
                    const existing = await tx.question.findFirst({
                        where: {
                            question: question.question,
                            airDate: new Date(formattedDate)
                        }
                    })

                    if (existing) {
                        skippedCount++
                        continue
                    }

                    // Create the question with proper round field
                    await tx.question.create({
                        data: {
                            question: question.question,
                            answer: question.answer,
                            value: question.value,
                            difficulty: question.difficulty,
                            knowledgeCategory: question.knowledgeCategory,
                            airDate: new Date(formattedDate),
                            round: toPrismaRound(question.round),
                            isDoubleJeopardy: question.round === 'DOUBLE', // Legacy field
                            wasTripleStumper: question.wasTripleStumper ?? false,
                            category: {
                                connect: { id: category.id }
                            }
                        }
                    })
                    savedCount++
                }
            })

            await prisma.$disconnect()

            return NextResponse.json({
                success: true,
                message: `Successfully saved ${savedCount} questions (skipped ${skippedCount} duplicates)`,
                gameId: game.gameId,
                airDate: formattedDate,
                questionCount: savedCount,
                skippedCount
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

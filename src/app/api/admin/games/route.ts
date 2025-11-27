import { prisma } from '@/lib/prisma'
import {
    jsonResponse,
    serverErrorResponse,
    requireAdmin,
    parseSearchParams,
    parseBody
} from '@/lib/api-utils'
import { z } from 'zod'

const searchParamsSchema = z.object({
    season: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional()
})

export async function GET(request: Request) {
    // Require admin access
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const { data: params, error } = parseSearchParams(searchParams, searchParamsSchema)
    if (error) return error

    const { season, startDate, endDate } = params

    // Build query filters
    const where: any = {}
    if (season) where.season = parseInt(season)
    
    // Handle date filtering - allow startDate only, endDate only, or both
    if (startDate || endDate) {
        where.airDate = {}
        if (startDate) {
            where.airDate.gte = new Date(startDate)
        }
        if (endDate) {
            where.airDate.lte = new Date(endDate)
        }
    }

    try {
        const games = await prisma.question.findMany({
            where,
            include: {
                category: true
            },
            orderBy: [
                { airDate: 'desc' },
                { season: 'desc' }
            ]
        })

        return jsonResponse({ games })
    } catch (error) {
        return serverErrorResponse('Error fetching games', error)
    }
}

const postBodySchema = z.object({
    action: z.enum(['import', 'delete', 'push']),
    data: z.any()
})

export async function POST(request: Request) {
    // Require admin access
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { data: body, error } = await parseBody(request, postBodySchema)
    if (error) return error

    try {
        const { action, data } = body

        switch (action) {
            case 'import':
                // Import new games
                await prisma.$transaction(async (tx) => {
                    for (const game of data) {
                        // Create or update categories
                        const category = await tx.category.upsert({
                            where: { name: game.category },
                            update: {},
                            create: { name: game.category }
                        })

                        // Create questions
                        await tx.question.create({
                            data: {
                                question: game.question,
                                answer: game.answer,
                                value: game.value,
                                categoryId: category.id,
                                difficulty: game.difficulty || 'MEDIUM',
                                airDate: game.airDate ? new Date(game.airDate) : null,
                                season: game.season,
                                episodeId: game.episodeId,
                                knowledgeCategory: game.knowledgeCategory || 'GENERAL_KNOWLEDGE',
                                wasTripleStumper: game.wasTripleStumper ?? false
                            }
                        })
                    }
                })
                return jsonResponse({ message: 'Games imported successfully' })

            case 'delete':
                // Delete games by criteria
                const { season: delSeason, startDate: delStartDate, endDate: delEndDate } = data
                const deleteWhere: Record<string, unknown> = {}
                if (delSeason) deleteWhere.season = delSeason
                if (delStartDate && delEndDate) {
                    deleteWhere.airDate = {
                        gte: new Date(delStartDate),
                        lte: new Date(delEndDate)
                    }
                }
                await prisma.question.deleteMany({ where: deleteWhere })
                return jsonResponse({ message: 'Games deleted successfully' })

            case 'push':
                // Push fetched game data to database
                const { game } = data
                if (!game || !game.questions || !Array.isArray(game.questions)) {
                    return jsonResponse({ error: 'Invalid game data' }, 400)
                }

                let created = 0
                let skipped = 0

                await prisma.$transaction(async (tx) => {
                    for (const question of game.questions) {
                        // Check if question already exists (by question text and air date)
                        const existing = await tx.question.findFirst({
                            where: {
                                question: question.question,
                                airDate: game.airDate ? new Date(game.airDate) : null
                            }
                        })

                        if (existing) {
                            skipped++
                            continue
                        }

                        // Create or update category
                        const category = await tx.category.upsert({
                            where: { name: question.category },
                            update: {},
                            create: { name: question.category }
                        })

                        // Determine round - support both new 'round' field and legacy 'isDoubleJeopardy'/'isFinalJeopardy'
                        let round: 'SINGLE' | 'DOUBLE' | 'FINAL' = 'SINGLE'
                        if (question.round) {
                            round = question.round as 'SINGLE' | 'DOUBLE' | 'FINAL'
                        } else if (question.isFinalJeopardy) {
                            round = 'FINAL'
                        } else if (question.isDoubleJeopardy) {
                            round = 'DOUBLE'
                        }

                        // Create question
                        await tx.question.create({
                            data: {
                                question: question.question,
                                answer: question.answer,
                                value: question.value,
                                categoryId: category.id,
                                difficulty: question.difficulty || 'MEDIUM',
                                airDate: game.airDate ? new Date(game.airDate) : null,
                                season: game.season,
                                episodeId: game.episodeId || game.gameId,
                                knowledgeCategory: question.knowledgeCategory || 'GENERAL_KNOWLEDGE',
                                round,
                                isDoubleJeopardy: round === 'DOUBLE', // Legacy field
                                wasTripleStumper: question.wasTripleStumper ?? false
                            }
                        })
                        created++
                    }
                })

                return jsonResponse({ 
                    message: `Game pushed successfully. Created: ${created}, Skipped: ${skipped}`,
                    created,
                    skipped
                })

            default:
                return jsonResponse({ error: 'Invalid action' }, 400)
        }
    } catch (error) {
        return serverErrorResponse('Error processing request', error)
    }
} 
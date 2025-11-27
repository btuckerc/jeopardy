/**
 * Admin API: Fetch Game from j-archive
 * 
 * Allows admins to fetch and preview game data from j-archive before pushing to the database.
 * Uses the modular jarchive-scraper library for all parsing logic.
 */

import { jsonResponse, serverErrorResponse, requireAdmin, parseSearchParams } from '@/lib/api-utils'
import { z } from 'zod'
import { 
    parseGameById, 
    parseGameByDate, 
    isValidDateFormat, 
    isFutureDate,
    getCurrentSeason,
    discoverSeasons
} from '@/lib/jarchive-scraper'

const searchParamsSchema = z.object({
    date: z.string().optional(),
    gameId: z.string().optional()
})

export async function GET(request: Request) {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const { data: params, error } = parseSearchParams(searchParams, searchParamsSchema)
    if (error) return error

    const { date, gameId } = params

    try {
        // Validate inputs
        if (!date && !gameId) {
            return jsonResponse({ error: 'Either date or gameId must be provided' }, 400)
        }

        if (date) {
            if (!isValidDateFormat(date)) {
                return jsonResponse({ 
                    success: false, 
                    message: `Invalid date format: ${date}. Expected YYYY-MM-DD.`,
                    game: null
                }, 400)
            }
            
            if (isFutureDate(date)) {
                return jsonResponse({ 
                    success: false, 
                    message: `Date ${date} appears to be in the future. Cannot fetch games for future dates.`,
                    game: null
                }, 400)
            }
        }

        // Parse game
        let game
        if (gameId) {
            game = await parseGameById(gameId)
        } else if (date) {
            game = await parseGameByDate(date)
        }

        if (!game) {
            // Get current season for help message
            const currentSeason = await getCurrentSeason()
            
            return jsonResponse({ 
                success: false, 
                message: date 
                    ? `No game found for date ${date}. The game may not be archived yet. You can manually find the Game ID at https://j-archive.com/listseasons.php`
                    : `Could not fetch game with ID ${gameId}.`,
                game: null,
                currentSeason
            })
        }

        // Transform categories to match expected format
        const transformedCategories = game.categories.map(cat => ({
            name: cat.name,
            round: cat.round.toLowerCase() as 'single' | 'double' | 'final',
            questions: cat.questions.map(q => ({
                question: q.question,
                answer: q.answer,
                value: q.value,
                category: q.category,
                round: q.round,
                isDoubleJeopardy: q.round === 'DOUBLE',
                isFinalJeopardy: q.round === 'FINAL',
                difficulty: q.difficulty,
                knowledgeCategory: q.knowledgeCategory
            }))
        }))

        return jsonResponse({
            success: true,
            game: {
                gameId: game.gameId,
                showNumber: game.showNumber,
                airDate: game.airDate,
                title: game.title,
                questionCount: game.questionCount,
                categories: transformedCategories,
                questions: game.questions.map(q => ({
                    ...q,
                    isDoubleJeopardy: q.round === 'DOUBLE',
                    isFinalJeopardy: q.round === 'FINAL'
                }))
            }
        })
    } catch (error) {
        console.error('Error fetching game:', error)
        return serverErrorResponse('Error fetching game data', error)
    }
}

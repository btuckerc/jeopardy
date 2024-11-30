import axios from 'axios'
import * as cheerio from 'cheerio'
import { writeFileSync } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { KnowledgeCategory } from '@prisma/client'

interface JeopardyGame {
    id: string;
    question: string;
    answer: string;
    value: number;
    category: string;
    knowledgeCategory: KnowledgeCategory;
    airDate?: string;
    season?: number;
    episodeId?: string;
}

// Knowledge category patterns for classification
const KNOWLEDGE_PATTERNS = {
    [KnowledgeCategory.GEOGRAPHY_AND_HISTORY]: {
        keywords: [
            'country', 'capital', 'city', 'river', 'mountain', 'ocean', 'continent', 'island', 'state',
            'war', 'president', 'king', 'queen', 'empire', 'revolution', 'dynasty', 'historical',
            'century', 'ancient', 'civilization', 'archaeology', 'explorer', 'conquest'
        ]
    },
    [KnowledgeCategory.ENTERTAINMENT]: {
        keywords: [
            'movie', 'film', 'actor', 'actress', 'director', 'oscar', 'hollywood', 'tv', 'show',
            'series', 'sitcom', 'music', 'song', 'singer', 'band', 'album', 'celebrity', 'star',
            'performance', 'concert', 'theater', 'musical', 'television', 'radio'
        ]
    },
    [KnowledgeCategory.ARTS_AND_LITERATURE]: {
        keywords: [
            'painting', 'artist', 'museum', 'sculpture', 'composer', 'symphony', 'ballet', 'dance',
            'opera', 'gallery', 'author', 'novel', 'book', 'poet', 'writer', 'play', 'shakespeare',
            'poem', 'literary', 'literature', 'art', 'painting', 'sculpture', 'architecture'
        ]
    },
    [KnowledgeCategory.SCIENCE_AND_NATURE]: {
        keywords: [
            'science', 'biology', 'chemistry', 'physics', 'astronomy', 'space', 'planet', 'star',
            'galaxy', 'atom', 'molecule', 'element', 'animal', 'plant', 'species', 'environment',
            'climate', 'weather', 'technology', 'computer', 'internet', 'invention', 'discovery'
        ]
    },
    [KnowledgeCategory.SPORTS_AND_LEISURE]: {
        keywords: [
            'sport', 'game', 'team', 'player', 'athlete', 'championship', 'olympic', 'tournament',
            'baseball', 'football', 'basketball', 'soccer', 'tennis', 'golf', 'hockey', 'racing',
            'score', 'winner', 'medal', 'recreation', 'hobby', 'leisure'
        ]
    }
}

function determineKnowledgeCategory(question: string, answer: string, categoryName: string): KnowledgeCategory {
    const text = `${question} ${answer} ${categoryName}`.toLowerCase()

    // Score each category based on keyword matches
    const scores = Object.entries(KNOWLEDGE_PATTERNS).map(([category, pattern]) => {
        const score = pattern.keywords.reduce((count, keyword) => {
            const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'g')
            const matches = text.match(regex)
            return count + (matches ? matches.length : 0)
        }, 0)
        return { category, score }
    })

    // Sort by score
    scores.sort((a, b) => b.score - a.score)

    // If we have a clear winner with a score > 0, use it
    if (scores[0].score > 0 && scores[0].score > (scores[1]?.score || 0)) {
        return scores[0].category as KnowledgeCategory
    }

    // Additional pattern matching for specific cases
    if (text.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/) ||
        text.includes('century') || 
        text.includes('ancient')) {
        return KnowledgeCategory.GEOGRAPHY_AND_HISTORY
    }

    // Default to general knowledge
    return KnowledgeCategory.GENERAL_KNOWLEDGE
}

async function scrapeJeopardyArchive(url: string): Promise<JeopardyGame[]> {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)
    const games: JeopardyGame[] = []

    // Extract season and episode info from URL
    const urlMatch = url.match(/game_id=(\d+)/)
    const gameId = urlMatch ? urlMatch[1] : null
    let season: number | undefined
    let episodeId: string | undefined

    if (gameId) {
        if (gameId.length >= 3) {
            season = parseInt(gameId.slice(0, -2))
            const episode = parseInt(gameId.slice(-2))
            episodeId = `S${season.toString().padStart(2, '0')}E${episode.toString().padStart(3, '0')}`
        }
    }

    // Extract air date
    const airDateText = $('.title').text()
    const airDateMatch = airDateText.match(/aired\s+([A-Za-z]+\s+\d+,\s+\d{4})/)
    const airDate = airDateMatch ? new Date(airDateMatch[1]).toISOString().split('T')[0] : undefined

    // Process both Jeopardy and Double Jeopardy rounds
    $('#jeopardy_round, #double_jeopardy_round').each((_, round) => {
        const $round = $(round)

        // Get categories for this round
        const categories: string[] = []
        $round.find('.category_name').each((_, el) => {
            categories.push($(el).text().trim())
        })

        // Process each category's clues
        categories.forEach((category, colIndex) => {
            // Find all clues in this category's column
            $round.find(`td.clue:nth-child(${colIndex + 1})`).each((_, clueCell) => {
                const $cell = $(clueCell)

                // Get the clue value
                const valueText = $cell.find('.clue_value').text().trim()
                const value = parseInt(valueText.replace(/[$,]/g, '')) || 200

                // Get the clue text
                const $clueText = $cell.find('.clue_text')
                const question = $clueText.text().trim()
                    .replace(/\\"/g, '"')
                    .replace(/\\'/g, "'")

                // Get the answer from the mouseover element
                const $answerText = $cell.find('.correct_response')
                let answer = $answerText.text().trim()
                    .replace(/\\"/g, '"')
                    .replace(/\\'/g, "'")

                // If no direct answer text, try to find it in the mouseover/click elements
                if (!answer) {
                    const mouseoverMatch = $cell.html()?.match(/<em class="correct_response">(.*?)<\/em>/i)
                    if (mouseoverMatch) {
                        answer = mouseoverMatch[1]
                            .replace(/<\/?[^>]+(>|$)/g, '')
                            .replace(/&quot;/g, '"')
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .trim()
                    }
                }

                if (question && answer) {
                    const knowledgeCategory = determineKnowledgeCategory(question, answer, category)
                    games.push({
                        id: crypto.randomUUID(),
                        question,
                        answer,
                        value,
                        category,
                        knowledgeCategory,
                        airDate,
                        season,
                        episodeId
                    })
                }
            })
        })
    })

    return games
}

async function main() {
    try {
        const numGames = process.argv[2] ? parseInt(process.argv[2]) : 10
        console.log(`Fetching ${numGames} games...`)

        const games: JeopardyGame[] = []
        let gamesProcessed = 0

        // Generate game IDs (starting from a more recent season)
        const startId = 7000 // More recent games
        const gameIds = Array.from({ length: numGames }, (_, i) => (startId + i).toString())

        for (const gameId of gameIds) {
            console.log(`Processing game ${++gamesProcessed}/${gameIds.length} (ID: ${gameId})`)
            const url = `https://j-archive.com/showgame.php?game_id=${gameId}`
            try {
                const newGames = await scrapeJeopardyArchive(url)
                console.log(`Found ${newGames.length} questions in game ${gameId}`)
                games.push(...newGames)
            } catch (error) {
                console.error(`Error processing game ${gameId}:`, error)
                continue
            }

            // Add a delay to be nice to the server
            await new Promise(resolve => setTimeout(resolve, 1000))
        }

        // Save to file
        const outputPath = path.join(__dirname, '../../data/jeopardy_questions.json')
        writeFileSync(outputPath, JSON.stringify(games, null, 2))
        console.log(`\nSaved ${games.length} questions to ${outputPath}`)

    } catch (error) {
        console.error('Error:', error)
        process.exit(1)
    }
}

if (require.main === module) {
    main().catch(console.error)
} 
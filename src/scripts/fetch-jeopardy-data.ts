import axios from 'axios'
import * as cheerio from 'cheerio'
import { writeFileSync } from 'fs'
import path from 'path'
import crypto from 'crypto'

type KnowledgeCategory =
    | 'GEOGRAPHY_AND_HISTORY'
    | 'ENTERTAINMENT'
    | 'ARTS_AND_LITERATURE'
    | 'SCIENCE_AND_NATURE'
    | 'SPORTS_AND_LEISURE'
    | 'GENERAL_KNOWLEDGE'

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
    wasTripleStumper?: boolean;
    isDoubleJeopardy?: boolean;
}

// Content analysis patterns for knowledge categories
function analyzeContent(text: string): KnowledgeCategory {
    const lowercaseText = text.toLowerCase()

    // Geography and History patterns
    if (
        /\b(1[0-9]{3}|20[0-2][0-9])\b/.test(text) || // Years
        /\b(century|ancient|historical|history|war|empire|kingdom|dynasty)\b/i.test(text) ||
        /\b(country|city|capital|state|continent|river|mountain|geography)\b/i.test(text)
    ) {
        return 'GEOGRAPHY_AND_HISTORY'
    }

    // Entertainment patterns
    if (
        /\b(movie|film|actor|actress|tv|television|show|music|song|band|celebrity)\b/i.test(text) ||
        /\b(oscar|emmy|grammy|award|hollywood|broadway|theatre|concert)\b/i.test(text) ||
        /\b(director|producer|star|performance|entertainment|series)\b/i.test(text)
    ) {
        return 'ENTERTAINMENT'
    }

    // Arts and Literature patterns
    if (
        /\b(book|novel|author|poet|writer|literature|literary|poem|poetry)\b/i.test(text) ||
        /\b(art|artist|painting|sculpture|museum|gallery|exhibition)\b/i.test(text) ||
        /\b(shakespeare|dickens|twain|hemingway|fitzgerald)\b/i.test(text)
    ) {
        return 'ARTS_AND_LITERATURE'
    }

    // Science and Nature patterns
    if (
        /\b(science|scientific|biology|chemistry|physics|astronomy)\b/i.test(text) ||
        /\b(animal|plant|species|nature|environment|climate|weather)\b/i.test(text) ||
        /\b(technology|computer|internet|invention|discovery|research)\b/i.test(text)
    ) {
        return 'SCIENCE_AND_NATURE'
    }

    // Sports and Leisure patterns
    if (
        /\b(sport|game|team|player|athlete|championship|tournament)\b/i.test(text) ||
        /\b(baseball|football|basketball|soccer|tennis|golf|hockey)\b/i.test(text) ||
        /\b(olympic|medal|score|winner|coach|league|stadium)\b/i.test(text)
    ) {
        return 'SPORTS_AND_LEISURE'
    }

    return 'GENERAL_KNOWLEDGE'
}

function determineKnowledgeCategory(question: string, answer: string, categoryName: string): KnowledgeCategory {
    // Combine all text for analysis
    const combinedText = `${categoryName} ${question} ${answer}`

    // Use content analysis to determine category
    const category = analyzeContent(combinedText)
    console.log(`Categorized "${categoryName}" as ${category}`)
    return category
}

function cleanText(text: string): string {
    return text
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/<\/?[^>]+(>|$)/g, '') // Remove any HTML tags
        .trim()
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

    // Extract air date from title
    const titleText = $('title').text()
    const airDateMatch = titleText.match(/aired\s+(\d{4})-(\d{2})-(\d{2})/)
    const airDate = airDateMatch ? `${airDateMatch[1]}-${airDateMatch[2]}-${airDateMatch[3]}` : undefined

    // Check if this is a pre-2001 game (when values were doubled)
    const isPreDoubledValues = airDate ? new Date(airDate) < new Date('2001-11-26') : false
    const valueMultiplier = isPreDoubledValues ? 2 : 1 // Double old values to normalize them

    // Process both Jeopardy and Double Jeopardy rounds
    $('#jeopardy_round, #double_jeopardy_round').each((_, round) => {
        const $round = $(round)
        const isDoubleJeopardy = $round.attr('id') === 'double_jeopardy_round'
        const baseValue = isDoubleJeopardy ? 400 : 200 // Modern base values

        // Get categories for this round
        const categories: string[] = []
        $round.find('.category_name').each((_, el) => {
            categories.push($(el).text().trim())
        })

        // Process each category's clues
        categories.forEach((category, categoryIndex) => {
            console.log(`\nProcessing category: ${category}`)

            // Find all clues for this category
            const $categoryCell = $round.find('.category').eq(categoryIndex)
            const $categoryRow = $categoryCell.closest('tr')
            const categoryColumn = $categoryCell.index() + 1

            // Get all clue rows after the category row
            let $currentRow = $categoryRow.next()
            let rowIndex = 0
            while ($currentRow.length && $currentRow.find('.clue_text').length) {
                const $clueCell = $currentRow.find(`td:nth-child(${categoryColumn})`)

                // Get the clue value from the header table
                let value: number
                const $clueHeader = $clueCell.find('.clue_header')
                if ($clueHeader.length) {
                    const $valueCell = $clueHeader.find('.clue_value, .clue_value_daily_double')
                    if ($valueCell.length) {
                        const valueText = $valueCell.text().trim()
                        const match = valueText.match(/\$(\d+)/)
                        const rawValue = match ? parseInt(match[1]) : baseValue * (rowIndex + 1)
                        value = rawValue * valueMultiplier // Normalize pre-2001 values
                    } else {
                        value = baseValue * (rowIndex + 1) * valueMultiplier
                    }
                } else {
                    value = baseValue * (rowIndex + 1) * valueMultiplier
                }

                // Get the clue text (question)
                const $clueText = $clueCell.find('.clue_text[id^="clue_"]').first()
                const question = cleanText($clueText.text())

                // Get the answer from the response element
                const $responseText = $clueCell.find('.clue_text[id$="_r"]')
                let answer = ''
                let wasTripleStumper = false

                if ($responseText.length) {
                    const correctResponseMatch = $responseText.html()?.match(/<em class="correct_response">(.*?)<\/em>/i)
                    if (correctResponseMatch) {
                        answer = cleanText(correctResponseMatch[1])
                    }
                    wasTripleStumper = $responseText.text().includes('Triple Stumper')
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
                        episodeId,
                        wasTripleStumper,
                        isDoubleJeopardy
                    })
                }

                $currentRow = $currentRow.next()
                rowIndex++
            }
        })
    })

    return games
}

async function main() {
    try {
        const numGames = process.argv[2] ? parseInt(process.argv[2]) : 10
        console.log(`Starting to fetch ${numGames} games...`)

        const games: JeopardyGame[] = []
        let gamesProcessed = 0

        // Generate game IDs (starting from a more recent season)
        const startId = 7000 // More recent games
        const gameIds = Array.from({ length: numGames }, (_, i) => (startId + i).toString())

        for (const gameId of gameIds) {
            const url = `https://j-archive.com/showgame.php?game_id=${gameId}`
            try {
                const newGames = await scrapeJeopardyArchive(url)
                console.log(`Game ${gameId}: Found ${newGames.length} questions (Aired: ${newGames[0]?.airDate || 'unknown'})`)
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
        console.log(`\nSuccessfully saved ${games.length} questions from ${gamesProcessed} games to ${outputPath}`)

    } catch (error) {
        console.error('Error:', error)
        process.exit(1)
    }
}

if (require.main === module) {
    main().catch(console.error)
} 
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
    let scores = {
        GEOGRAPHY_AND_HISTORY: 0,
        ENTERTAINMENT: 0,
        ARTS_AND_LITERATURE: 0,
        SCIENCE_AND_NATURE: 0,
        SPORTS_AND_LEISURE: 0,
        GENERAL_KNOWLEDGE: 0
    }

    // Literature-specific patterns
    if (
        /\b(novel|book|author|poem|poetry|playwright|fiction|literature|literary|chapter|verse)\b/i.test(text) ||
        /\b(shakespeare|dickens|novel|story|writer|poet|character)\b/i.test(text) ||
        /\b(bestseller|paperback|hardcover|publisher|anthology|trilogy|series)\b/i.test(text)
    ) {
        scores.ARTS_AND_LITERATURE += 3
    }

    // Arts-specific patterns
    if (
        /\b(art|artist|painting|sculpture|museum|gallery|exhibition)\b/i.test(text) ||
        /\b(canvas|palette|curator|masterpiece|portrait|landscape|abstract)\b/i.test(text) ||
        /\b(renaissance|baroque|impressionist|modern art|contemporary art)\b/i.test(text)
    ) {
        scores.ARTS_AND_LITERATURE += 3
    }

    // Geography patterns - more specific
    if (
        /\b(capital|continent|river|mountain range|ocean|sea|peninsula|gulf)\b/i.test(text) ||
        /\b(border|territory|region|province|hemisphere|latitude|longitude)\b/i.test(text) ||
        /\b(europe|asia|africa|america|australia|antarctic)\w*\b/i.test(text)
    ) {
        scores.GEOGRAPHY_AND_HISTORY += 2
    }

    // History patterns - more context-aware
    if (
        /\b(ancient|historical|empire|dynasty|civilization|archaeology)\b/i.test(text) ||
        /\b(revolution|colonial|medieval|renaissance|reformation|conquest)\b/i.test(text) ||
        (/\b(1[0-9]{3}|20[0-2][0-9])\b/.test(text) &&
            /\b(war|battle|treaty|revolution|president|emperor|reign)\b/i.test(text))
    ) {
        scores.GEOGRAPHY_AND_HISTORY += 2
    }

    // Entertainment - more specific to media and performance
    if (
        /\b(movie|film|cinema|actor|actress|director|producer)\b/i.test(text) ||
        /\b(tv show|television series|sitcom|drama series|reality show)\b/i.test(text) ||
        /\b(oscar|emmy|grammy|golden globe|billboard|box office)\b/i.test(text) ||
        /\b(song|album|band|singer|musician|concert|tour|chart)\b/i.test(text)
    ) {
        scores.ENTERTAINMENT += 3
    }

    // Science patterns - more technical
    if (
        /\b(biology|chemistry|physics|astronomy|geology|mathematics)\b/i.test(text) ||
        /\b(scientist|experiment|theory|hypothesis|research|discovery)\b/i.test(text) ||
        /\b(element|molecule|atom|cell|gene|species|evolution)\b/i.test(text) ||
        /\b(technology|invention|innovation|patent|engineering)\b/i.test(text)
    ) {
        scores.SCIENCE_AND_NATURE += 3
    }

    // Nature patterns
    if (
        /\b(animal|plant|species|ecosystem|habitat|environment)\b/i.test(text) ||
        /\b(wildlife|marine|forest|jungle|desert|climate|weather)\b/i.test(text) ||
        /\b(endangered|extinct|conservation|biodiversity|natural)\b/i.test(text)
    ) {
        scores.SCIENCE_AND_NATURE += 2
    }

    // Sports patterns - more specific
    if (
        /\b(baseball|football|basketball|soccer|tennis|golf|hockey)\b/i.test(text) ||
        /\b(olympics?|medal|championship|tournament|league|world cup)\b/i.test(text) ||
        /\b(athlete|player|team|coach|stadium|record|score)\b/i.test(text) ||
        /\b(sport|game|match|competition|victory|defeat|title)\b/i.test(text)
    ) {
        scores.SPORTS_AND_LEISURE += 3
    }

    // Category name specific boosts - increased weight and more specific patterns
    const categoryPatterns = {
        GEOGRAPHY_AND_HISTORY: {
            patterns: [
                /\b(geography|cartography|maps?|atlas)\b/i,
                /\b(history|historical|ancient|medieval)\b/i,
                /\b(world|countries|nations|capitals)\b/i
            ],
            boost: 4
        },
        ENTERTAINMENT: {
            patterns: [
                /\b(movies?|films?|cinema)\b/i,
                /\b(television|tv shows?|series)\b/i,
                /\b(music|songs?|albums?|bands?)\b/i
            ],
            boost: 4
        },
        ARTS_AND_LITERATURE: {
            patterns: [
                /\b(literature|literary|books?)\b/i,
                /\b(arts?|artistic|paintings?)\b/i,
                /\b(authors?|writers?|poets?)\b/i
            ],
            boost: 4
        },
        SCIENCE_AND_NATURE: {
            patterns: [
                /\b(science|scientific|laboratory)\b/i,
                /\b(nature|natural|wildlife)\b/i,
                /\b(biology|chemistry|physics)\b/i
            ],
            boost: 4
        },
        SPORTS_AND_LEISURE: {
            patterns: [
                /\b(sports?|sporting|athletics)\b/i,
                /\b(games?|gaming|recreation)\b/i,
                /\b(leisure|hobbies|pastimes)\b/i
            ],
            boost: 4
        }
    }

    // Apply category name boosts with more sophisticated matching
    for (const [category, config] of Object.entries(categoryPatterns)) {
        const matchCount = config.patterns.reduce((count, pattern) =>
            count + (pattern.test(text) ? 1 : 0), 0)
        if (matchCount > 0) {
            scores[category as keyof typeof scores] += config.boost * matchCount
        }
    }

    // Find the category with the highest score
    let maxScore = 0
    let selectedCategory: KnowledgeCategory = 'GENERAL_KNOWLEDGE'

    for (const [category, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score
            selectedCategory = category as KnowledgeCategory
        }
    }

    // Higher threshold for classification
    return maxScore > 2 ? selectedCategory : 'GENERAL_KNOWLEDGE'
}

function determineKnowledgeCategoryForQuestions(questions: { question: string; answer: string }[], categoryName: string): KnowledgeCategory {
    // Combine all questions and answers with extra weight on category name
    const combinedText = `${categoryName} ${categoryName} ${categoryName} ` +
        questions.map(q => `${q.question} ${q.answer}`).join(' ')

    // Use content analysis to determine category
    return analyzeContent(combinedText)
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
            // Find all clues for this category
            const $categoryCell = $round.find('.category').eq(categoryIndex)
            const $categoryRow = $categoryCell.closest('tr')
            const categoryColumn = $categoryCell.index() + 1

            // Collect all questions for this category first
            const categoryQuestions: { question: string; answer: string; value: number; wasTripleStumper: boolean }[] = []

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
                    categoryQuestions.push({ question, answer, value, wasTripleStumper })
                }

                $currentRow = $currentRow.next()
                rowIndex++
            }

            // Determine knowledge category for all questions in this category
            if (categoryQuestions.length > 0) {
                const knowledgeCategory = determineKnowledgeCategoryForQuestions(categoryQuestions, category)

                // Add all questions with the same knowledge category
                categoryQuestions.forEach(({ question, answer, value, wasTripleStumper }) => {
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
                })
            }
        })
    })

    return games
}

interface FetchOptions {
    startDate?: string;
    endDate?: string;
    numGames?: number;
    maxAttempts?: number;
    searchDirection?: 'forward' | 'backward';
}

interface GameMatch {
    id: string;
    date: Date;
}

async function checkGameDate(gameId: string): Promise<Date | null> {
    const url = `https://j-archive.com/showgame.php?game_id=${gameId}`
    try {
        const response = await axios.get(url, {
            maxRedirects: 5,
            validateStatus: null,
            timeout: 5000
        })

        if (response.status !== 200) {
            console.log(`Game ${gameId}: Got status ${response.status}`)
            return null
        }

        const titleMatch = response.data.match(/<title>[^#]*#\d+,\s*aired\s+(\d{4}-\d{2}-\d{2})/i)
        if (titleMatch && titleMatch[1]) {
            const dateStr = titleMatch[1].trim()
            const date = new Date(dateStr)
            if (!isNaN(date.getTime())) {
                return date
            }
        }

        const titleText = response.data.match(/<title>(.*?)<\/title>/i)?.[1] || 'No title found'
        console.log(`Game ${gameId}: Could not parse date from title: "${titleText}"`)
        return null
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(`Game ${gameId}: Network error - ${error.message}`)
        } else {
            console.error(`Game ${gameId}: Unexpected error - ${error}`)
        }
        return null
    }
}

async function findCurrentSeason(): Promise<number> {
    try {
        const response = await axios.get('https://j-archive.com/listseasons.php')
        const seasonMatches = response.data.match(/season=(\d+)/g)
        if (seasonMatches) {
            // First map to convert strings to numbers
            const seasonNumbers: number[] = seasonMatches
                .map((m: string) => parseInt(m.replace('season=', '')))
                .filter((n: number) => !isNaN(n))

            // Then create a Set of unique values
            const uniqueSeasons: number[] = [...new Set(seasonNumbers)]

            if (uniqueSeasons.length > 0) {
                return Math.max(...uniqueSeasons)
            }
        }
    } catch (error) {
        console.error('Error finding current season:', error)
    }
    // If we can't determine the current season, throw an error rather than using a hardcoded fallback
    throw new Error('Could not determine current season from j-archive. Please check network connection or j-archive availability.')
}

async function findGameIdsForSeason(season: number): Promise<number[]> {
    try {
        const url = `https://j-archive.com/showseason.php?season=${season}`
        const response = await axios.get(url)

        const gameIds: number[] = []
        const matches = response.data.matchAll(/game_id=(\d+)/g)
        for (const match of matches) {
            const id = parseInt(match[1])
            if (!isNaN(id)) {
                gameIds.push(id)
            }
        }

        return gameIds.sort((a: number, b: number) => b - a) // Sort in descending order
    } catch (error) {
        console.error(`Error fetching season ${season}:`, error)
        return []
    }
}

async function findRelevantGameIds(startDate: string, endDate: string): Promise<number[]> {
    const gameIds: number[] = []
    const startYear = new Date(startDate).getFullYear()
    const endYear = new Date(endDate).getFullYear()

    const currentSeason = await findCurrentSeason()
    console.log(`Current season is ${currentSeason}`)

    const startSeason = Math.floor((startYear - 1984) * (365 / 365)) + 1
    const endSeason = Math.ceil((endYear - 1984) * (365 / 365)) + 1
    const maxSeason = Math.min(endSeason, currentSeason)

    console.log(`Scanning seasons ${startSeason} to ${maxSeason} for games...`)

    for (let season = maxSeason; season >= startSeason; season--) {
        console.log(`Scanning season ${season}...`)
        const seasonGameIds = await findGameIdsForSeason(season)
        if (seasonGameIds.length > 0) {
            console.log(`Found ${seasonGameIds.length} games in season ${season}`)
            gameIds.push(...seasonGameIds)
        }
        await new Promise(resolve => setTimeout(resolve, 500))
    }

    return gameIds.sort((a: number, b: number) => a - b)
}

async function main() {
    try {
        // Parse command line arguments
        const options: FetchOptions = {
            maxAttempts: 1000,
            searchDirection: 'forward'
        }

        // Parse arguments
        for (let i = 2; i < process.argv.length; i += 2) {
            const arg = process.argv[i]
            const value = process.argv[i + 1]

            switch (arg) {
                case '--start-date':
                    options.startDate = value
                    break
                case '--end-date':
                    options.endDate = value
                    break
                case '--num-games':
                    options.numGames = parseInt(value)
                    break
                case '--max-attempts':
                    options.maxAttempts = parseInt(value)
                    break
            }
        }

        if (!options.startDate || !options.endDate) {
            console.error('Both --start-date and --end-date are required')
            process.exit(1)
        }

        console.log('Finding games between', options.startDate, 'and', options.endDate)

        // First, find all relevant game IDs from the season pages
        const gameIds = await findRelevantGameIds(options.startDate, options.endDate)
        console.log(`Found ${gameIds.length} potential games to check`)

        const games: JeopardyGame[] = []
        let gamesProcessed = 0
        let gamesFound = 0
        let consecutiveErrors = 0

        for (const gameId of gameIds) {
            if (consecutiveErrors >= 5) {
                console.log('Too many consecutive errors, stopping search...')
                break
            }

            // Quick check of the game date first
            const gameDate = await checkGameDate(gameId.toString())
            if (!gameDate) {
                consecutiveErrors++
                continue
            }

            // Reset error counter on successful date check
            consecutiveErrors = 0

            // Check if date is in range
            if (gameDate < new Date(options.startDate)) {
                console.log(`Game ${gameId} from ${gameDate.toLocaleDateString()}: Too early, skipping...`)
                continue
            }

            if (gameDate > new Date(options.endDate)) {
                console.log(`Game ${gameId} from ${gameDate.toLocaleDateString()}: Too late, skipping...`)
                continue
            }

            // If date is in range, fetch the full game
            console.log(`Game ${gameId} from ${gameDate.toLocaleDateString()}: In range, fetching questions...`)
            try {
                const newGames = await scrapeJeopardyArchive(`https://j-archive.com/showgame.php?game_id=${gameId}`)

                if (newGames.length > 0) {
                    console.log(`  ✓ Found ${newGames.length} questions`)
                    games.push(...newGames)
                    gamesFound++
                } else {
                    console.log('  ✗ No questions found in game')
                }

                gamesProcessed++

                // Stop if we've found enough games (only if numGames is specified)
                if (options.numGames && gamesFound >= options.numGames) {
                    console.log(`Reached target number of games (${options.numGames}), stopping search...`)
                    break
                }
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
        console.log(`\nSuccessfully saved ${games.length} questions from ${gamesFound} games to ${outputPath}`)
        console.log(`Processed ${gamesProcessed} total games`)

    } catch (error) {
        console.error('Error:', error)
        process.exit(1)
    }
}

if (require.main === module) {
    main().catch((error: Error) => {
        console.error('Error:', error)
        process.exit(1)
    })
}
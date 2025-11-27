/**
 * J-Archive Backfill Script
 * 
 * Fetches historical Jeopardy questions from J-Archive and saves to JSON.
 * This is a more robust version of fetch-jeopardy-data.ts with:
 * - Better rate limiting to respect J-Archive
 * - Resumable progress tracking
 * - Improved error handling
 * - Progress reporting
 * - Optional semantic category inference using embeddings
 * 
 * Usage:
 *   npx ts-node src/scripts/backfill-jarchive.ts --start-date 2020-01-01 --end-date 2024-12-31
 * 
 * Options:
 *   --start-date    Start date (YYYY-MM-DD)
 *   --end-date      End date (YYYY-MM-DD)
 *   --output        Output file path (default: data/jeopardy_questions.json)
 *   --append        Append to existing file instead of overwriting
 *   --resume        Resume from last progress checkpoint
 *   --delay         Delay between requests in ms (default: 1500)
 * 
 * Note: Knowledge categories are inferred using pattern matching during scraping.
 * For better accuracy, run seed-database.ts with OPENAI_API_KEY set to use
 * semantic embeddings for category inference.
 */

import axios, { AxiosError } from 'axios'
import * as cheerio from 'cheerio'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'

// Types
type KnowledgeCategory =
    | 'GEOGRAPHY_AND_HISTORY'
    | 'ENTERTAINMENT'
    | 'ARTS_AND_LITERATURE'
    | 'SCIENCE_AND_NATURE'
    | 'SPORTS_AND_LEISURE'
    | 'GENERAL_KNOWLEDGE'

interface JeopardyQuestion {
    id: string
    question: string
    answer: string
    value: number
    category: string
    knowledgeCategory: KnowledgeCategory
    airDate?: string
    season?: number
    episodeId?: string
    wasTripleStumper?: boolean
    isDoubleJeopardy?: boolean
}

interface FetchProgress {
    lastGameId: number
    processedGameIds: number[]
    totalQuestions: number
    lastUpdated: string
}

interface FetchOptions {
    startDate: string
    endDate: string
    outputPath: string
    append: boolean
    resume: boolean
    delayMs: number
}

// Constants
const PROGRESS_FILE = 'data/.backfill-progress.json'
const USER_AGENT = 'Mozilla/5.0 (compatible; TrivrdyBot/1.0; +https://trivrdy.com)'
const MAX_RETRIES = 3
const RETRY_DELAY = 5000

// Knowledge category classifier (same as existing)
function analyzeContent(text: string): KnowledgeCategory {
    const lowercaseText = text.toLowerCase()
    const scores = {
        GEOGRAPHY_AND_HISTORY: 0,
        ENTERTAINMENT: 0,
        ARTS_AND_LITERATURE: 0,
        SCIENCE_AND_NATURE: 0,
        SPORTS_AND_LEISURE: 0,
        GENERAL_KNOWLEDGE: 0
    }

    // Literature patterns
    if (/\b(novel|book|author|poem|poetry|playwright|fiction|literature|literary)\b/i.test(text)) {
        scores.ARTS_AND_LITERATURE += 3
    }

    // Arts patterns
    if (/\b(art|artist|painting|sculpture|museum|gallery|exhibition)\b/i.test(text)) {
        scores.ARTS_AND_LITERATURE += 3
    }

    // Geography patterns
    if (/\b(capital|continent|river|mountain|ocean|sea|country|nation)\b/i.test(text)) {
        scores.GEOGRAPHY_AND_HISTORY += 2
    }

    // History patterns
    if (/\b(ancient|historical|empire|dynasty|civilization|war|battle|president)\b/i.test(text)) {
        scores.GEOGRAPHY_AND_HISTORY += 2
    }

    // Entertainment patterns
    if (/\b(movie|film|actor|actress|director|tv|television|song|album|band)\b/i.test(text)) {
        scores.ENTERTAINMENT += 3
    }

    // Science patterns
    if (/\b(biology|chemistry|physics|astronomy|scientist|experiment|element)\b/i.test(text)) {
        scores.SCIENCE_AND_NATURE += 3
    }

    // Nature patterns
    if (/\b(animal|plant|species|ecosystem|habitat|wildlife)\b/i.test(text)) {
        scores.SCIENCE_AND_NATURE += 2
    }

    // Sports patterns
    if (/\b(baseball|football|basketball|soccer|tennis|golf|olympics?|athlete)\b/i.test(text)) {
        scores.SPORTS_AND_LEISURE += 3
    }

    // Find highest score
    let maxScore = 0
    let selectedCategory: KnowledgeCategory = 'GENERAL_KNOWLEDGE'

    for (const [category, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score
            selectedCategory = category as KnowledgeCategory
        }
    }

    return maxScore > 2 ? selectedCategory : 'GENERAL_KNOWLEDGE'
}

function determineKnowledgeCategory(questions: { question: string; answer: string }[], categoryName: string): KnowledgeCategory {
    const combinedText = `${categoryName} ${categoryName} ${categoryName} ` +
        questions.map(q => `${q.question} ${q.answer}`).join(' ')
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
        .replace(/<\/?[^>]+(>|$)/g, '')
        .trim()
}

// HTTP client with retry logic
async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<string> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.get(url, {
                headers: { 'User-Agent': USER_AGENT },
                timeout: 15000,
                maxRedirects: 5
            })
            return response.data
        } catch (error) {
            const isLastAttempt = attempt === retries
            
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError
                if (axiosError.response?.status === 404) {
                    throw new Error('Game not found')
                }
                if (axiosError.response?.status === 429) {
                    console.log(`   Rate limited, waiting ${RETRY_DELAY * 2}ms...`)
                    await sleep(RETRY_DELAY * 2)
                    continue
                }
            }
            
            if (!isLastAttempt) {
                console.log(`   Retry ${attempt}/${retries} after error: ${error}`)
                await sleep(RETRY_DELAY)
            } else {
                throw error
            }
        }
    }
    throw new Error('Max retries exceeded')
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// Scrape a single game
async function scrapeGame(gameId: number): Promise<JeopardyQuestion[]> {
    const url = `https://j-archive.com/showgame.php?game_id=${gameId}`
    const html = await fetchWithRetry(url)
    const $ = cheerio.load(html)
    const questions: JeopardyQuestion[] = []

    // Extract metadata from title
    const titleText = $('title').text()
    const airDateMatch = titleText.match(/aired\s+(\d{4})-(\d{2})-(\d{2})/)
    const airDate = airDateMatch ? `${airDateMatch[1]}-${airDateMatch[2]}-${airDateMatch[3]}` : undefined

    if (!airDate) {
        return [] // Skip games without air dates
    }

    // Calculate season and episode
    const gameIdStr = gameId.toString()
    let season: number | undefined
    let episodeId: string | undefined
    
    if (gameIdStr.length >= 3) {
        season = parseInt(gameIdStr.slice(0, -2))
        const episode = parseInt(gameIdStr.slice(-2))
        episodeId = `S${season.toString().padStart(2, '0')}E${episode.toString().padStart(3, '0')}`
    }

    // Normalize pre-2001 values
    const isPreDoubledValues = airDate ? new Date(airDate) < new Date('2001-11-26') : false
    const valueMultiplier = isPreDoubledValues ? 2 : 1

    // Process both rounds
    $('#jeopardy_round, #double_jeopardy_round').each((_, round) => {
        const $round = $(round)
        const isDoubleJeopardy = $round.attr('id') === 'double_jeopardy_round'
        const baseValue = isDoubleJeopardy ? 400 : 200

        // Get categories
        const categories: string[] = []
        $round.find('.category_name').each((_, el) => {
            categories.push($(el).text().trim())
        })

        // Process each category
        categories.forEach((categoryName, categoryIndex) => {
            const $categoryCell = $round.find('.category').eq(categoryIndex)
            const $categoryRow = $categoryCell.closest('tr')
            const categoryColumn = $categoryCell.index() + 1

            const categoryQuestions: { question: string; answer: string; value: number; wasTripleStumper: boolean }[] = []

            let $currentRow = $categoryRow.next()
            let rowIndex = 0

            while ($currentRow.length && $currentRow.find('.clue_text').length) {
                const $clueCell = $currentRow.find(`td:nth-child(${categoryColumn})`)

                // Get value
                let value: number
                const $clueHeader = $clueCell.find('.clue_header')
                if ($clueHeader.length) {
                    const $valueCell = $clueHeader.find('.clue_value, .clue_value_daily_double')
                    if ($valueCell.length) {
                        const valueText = $valueCell.text().trim()
                        const match = valueText.match(/\$(\d+)/)
                        const rawValue = match ? parseInt(match[1]) : baseValue * (rowIndex + 1)
                        value = rawValue * valueMultiplier
                    } else {
                        value = baseValue * (rowIndex + 1) * valueMultiplier
                    }
                } else {
                    value = baseValue * (rowIndex + 1) * valueMultiplier
                }

                // Get question and answer
                const $clueText = $clueCell.find('.clue_text[id^="clue_"]').first()
                const question = cleanText($clueText.text())

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

            // Add questions with knowledge category
            if (categoryQuestions.length > 0) {
                const knowledgeCategory = determineKnowledgeCategory(categoryQuestions, categoryName)

                categoryQuestions.forEach(({ question, answer, value, wasTripleStumper }) => {
                    questions.push({
                        id: crypto.randomUUID(),
                        question,
                        answer,
                        value,
                        category: categoryName,
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

    return questions
}

// Find game IDs for a season
async function getSeasonGameIds(season: number): Promise<number[]> {
    try {
        const url = `https://j-archive.com/showseason.php?season=${season}`
        const html = await fetchWithRetry(url)
        
        const gameIds: number[] = []
        const matches = html.matchAll(/game_id=(\d+)/g)
        for (const match of matches) {
            const id = parseInt(match[1])
            if (!isNaN(id)) {
                gameIds.push(id)
            }
        }
        
        return [...new Set(gameIds)].sort((a, b) => a - b)
    } catch (error) {
        console.error(`Error fetching season ${season}:`, error)
        return []
    }
}

// Get current season number
async function getCurrentSeason(): Promise<number> {
    try {
        const html = await fetchWithRetry('https://j-archive.com/listseasons.php')
        const seasonMatches = html.match(/season=(\d+)/g)
        
        if (seasonMatches) {
            const seasons = seasonMatches
                .map(m => parseInt(m.replace('season=', '')))
                .filter(n => !isNaN(n))
            
            if (seasons.length > 0) {
                return Math.max(...seasons)
            }
        }
    } catch (error) {
        console.error('Error finding current season:', error)
    }
    return 41 // Fallback
}

// Load/save progress
function loadProgress(): FetchProgress | null {
    try {
        if (existsSync(PROGRESS_FILE)) {
            return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'))
        }
    } catch (error) {
        console.error('Error loading progress:', error)
    }
    return null
}

function saveProgress(progress: FetchProgress): void {
    try {
        writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
    } catch (error) {
        console.error('Error saving progress:', error)
    }
}

// Main backfill function
async function backfill(options: FetchOptions): Promise<void> {
    console.log('🚀 Starting J-Archive backfill...')
    console.log(`   Date range: ${options.startDate} to ${options.endDate}`)
    console.log(`   Output: ${options.outputPath}`)
    console.log(`   Delay: ${options.delayMs}ms`)
    console.log('')

    const startDate = new Date(options.startDate)
    const endDate = new Date(options.endDate)

    // Load existing questions if appending
    let allQuestions: JeopardyQuestion[] = []
    const existingHashes = new Set<string>()
    
    if (options.append && existsSync(options.outputPath)) {
        console.log('📖 Loading existing questions...')
        const existing = JSON.parse(readFileSync(options.outputPath, 'utf-8'))
        allQuestions = existing
        
        // Build hash set for deduplication
        existing.forEach((q: JeopardyQuestion) => {
            const hash = crypto.createHash('md5')
                .update(`${q.question}|${q.answer}|${q.category}`.toLowerCase())
                .digest('hex')
            existingHashes.add(hash)
        })
        
        console.log(`   ${allQuestions.length.toLocaleString()} existing questions loaded`)
    }

    // Load progress if resuming
    let progress: FetchProgress | null = null
    if (options.resume) {
        progress = loadProgress()
        if (progress) {
            console.log(`📋 Resuming from game ${progress.lastGameId}`)
            console.log(`   ${progress.processedGameIds.length} games already processed`)
        }
    }

    const processedGameIds = new Set(progress?.processedGameIds || [])

    // Determine seasons to scan
    const startYear = startDate.getFullYear()
    const endYear = endDate.getFullYear()
    const currentSeason = await getCurrentSeason()
    
    // Approximate season calculation (Jeopardy started 1984)
    const startSeason = Math.max(1, Math.floor((startYear - 1984) + 1))
    const endSeason = Math.min(currentSeason, Math.ceil((endYear - 1984) + 2))

    console.log(`\n📺 Scanning seasons ${startSeason} to ${endSeason}...`)

    let totalGamesProcessed = 0
    let totalQuestionsAdded = 0
    let totalErrors = 0

    for (let season = endSeason; season >= startSeason; season--) {
        console.log(`\n📅 Season ${season}:`)
        
        const gameIds = await getSeasonGameIds(season)
        console.log(`   Found ${gameIds.length} games`)
        
        for (const gameId of gameIds) {
            // Skip if already processed
            if (processedGameIds.has(gameId)) {
                continue
            }

            try {
                const questions = await scrapeGame(gameId)
                
                if (questions.length === 0) {
                    continue
                }

                // Check if game is in date range
                const gameDate = questions[0].airDate ? new Date(questions[0].airDate) : null
                if (!gameDate || gameDate < startDate || gameDate > endDate) {
                    continue
                }

                // Filter duplicates
                const newQuestions = questions.filter(q => {
                    const hash = crypto.createHash('md5')
                        .update(`${q.question}|${q.answer}|${q.category}`.toLowerCase())
                        .digest('hex')
                    
                    if (existingHashes.has(hash)) {
                        return false
                    }
                    existingHashes.add(hash)
                    return true
                })

                if (newQuestions.length > 0) {
                    allQuestions.push(...newQuestions)
                    totalQuestionsAdded += newQuestions.length
                    console.log(`   ✓ Game ${gameId} (${questions[0].airDate}): ${newQuestions.length} questions`)
                }

                processedGameIds.add(gameId)
                totalGamesProcessed++

                // Save progress periodically
                if (totalGamesProcessed % 10 === 0) {
                    saveProgress({
                        lastGameId: gameId,
                        processedGameIds: [...processedGameIds],
                        totalQuestions: allQuestions.length,
                        lastUpdated: new Date().toISOString()
                    })
                    
                    // Also save questions periodically
                    writeFileSync(options.outputPath, JSON.stringify(allQuestions, null, 2))
                }

                // Rate limiting
                await sleep(options.delayMs)

            } catch (error) {
                if (error instanceof Error && error.message === 'Game not found') {
                    continue
                }
                console.error(`   ✗ Error processing game ${gameId}:`, error)
                totalErrors++
                
                if (totalErrors > 50) {
                    console.error('\n❌ Too many errors, stopping...')
                    break
                }
            }
        }
    }

    // Final save
    writeFileSync(options.outputPath, JSON.stringify(allQuestions, null, 2))

    // Clear progress file on completion
    if (existsSync(PROGRESS_FILE)) {
        const fs = require('fs')
        fs.unlinkSync(PROGRESS_FILE)
    }

    // Summary
    console.log('\n' + '='.repeat(50))
    console.log('📊 BACKFILL COMPLETE')
    console.log('='.repeat(50))
    console.log(`   Games processed: ${totalGamesProcessed.toLocaleString()}`)
    console.log(`   Questions added: ${totalQuestionsAdded.toLocaleString()}`)
    console.log(`   Total questions: ${allQuestions.length.toLocaleString()}`)
    console.log(`   Errors: ${totalErrors}`)
    console.log(`   Output: ${options.outputPath}`)
    console.log('='.repeat(50))
}

// CLI
async function main() {
    const args = process.argv.slice(2)
    
    const options: FetchOptions = {
        startDate: '',
        endDate: '',
        outputPath: path.join(process.cwd(), 'data/jeopardy_questions.json'),
        append: false,
        resume: false,
        delayMs: 1500
    }

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--start-date':
                options.startDate = args[++i]
                break
            case '--end-date':
                options.endDate = args[++i]
                break
            case '--output':
                options.outputPath = args[++i]
                break
            case '--append':
                options.append = true
                break
            case '--resume':
                options.resume = true
                break
            case '--delay':
                options.delayMs = parseInt(args[++i])
                break
            case '--help':
                console.log(`
J-Archive Backfill Script

Usage:
  npx ts-node src/scripts/backfill-jarchive.ts [options]

Options:
  --start-date <date>  Start date (YYYY-MM-DD) [required]
  --end-date <date>    End date (YYYY-MM-DD) [required]
  --output <path>      Output file path (default: data/jeopardy_questions.json)
  --append             Append to existing file instead of overwriting
  --resume             Resume from last progress checkpoint
  --delay <ms>         Delay between requests in ms (default: 1500)
  --help               Show this help message

Example:
  npx ts-node src/scripts/backfill-jarchive.ts --start-date 2020-01-01 --end-date 2024-12-31 --append
                `)
                process.exit(0)
        }
    }

    // Validate required options
    if (!options.startDate || !options.endDate) {
        console.error('Error: --start-date and --end-date are required')
        console.error('Run with --help for usage information')
        process.exit(1)
    }

    try {
        await backfill(options)
        process.exit(0)
    } catch (error) {
        console.error('\n❌ Backfill failed:', error)
        process.exit(1)
    }
}

main()


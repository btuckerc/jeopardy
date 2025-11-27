/**
 * J-Archive Scraper Library
 * 
 * A modular, reusable library for scraping game data from j-archive.com
 * This centralizes all scraping logic to ensure consistency across the application.
 */

import axios, { AxiosInstance } from 'axios'
import { parse, HTMLElement } from 'node-html-parser'
import { KnowledgeCategory } from '@prisma/client'

// ============================================================================
// Types
// ============================================================================

export type JeopardyRound = 'SINGLE' | 'DOUBLE' | 'FINAL'

export interface ParsedQuestion {
    question: string
    answer: string
    value: number
    category: string
    round: JeopardyRound
    difficulty: 'EASY' | 'MEDIUM' | 'HARD'
    knowledgeCategory: KnowledgeCategory
}

export interface ParsedCategory {
    name: string
    round: JeopardyRound
    questions: ParsedQuestion[]
}

export interface ParsedGame {
    gameId: string
    showNumber: string | null
    airDate: string | null
    title: string
    categories: ParsedCategory[]
    questions: ParsedQuestion[]
    questionCount: number
}

export interface SeasonInfo {
    seasonNumber: number
    url: string
    games: SeasonGame[]
}

export interface SeasonGame {
    gameId: string
    showNumber: string
    airDate: string
    tapedDate: string | null
    url: string
}

// ============================================================================
// Constants
// ============================================================================

const J_ARCHIVE_BASE_URL = 'https://j-archive.com'
const DEFAULT_TIMEOUT = 15000
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ============================================================================
// HTTP Client
// ============================================================================

function createHttpClient(): AxiosInstance {
    return axios.create({
        baseURL: J_ARCHIVE_BASE_URL,
        timeout: DEFAULT_TIMEOUT,
        headers: {
            'User-Agent': DEFAULT_USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }
    })
}

const httpClient = createHttpClient()

// ============================================================================
// Knowledge Category Classification
// ============================================================================

export function classifyKnowledgeCategory(categoryName: string): KnowledgeCategory {
    const lower = categoryName.toLowerCase()
    
    // Geography & History
    if (lower.includes('history') || lower.includes('geography') || 
        lower.includes('world') || lower.includes('capital') ||
        lower.includes('president') || lower.includes('war') ||
        lower.includes('country') || lower.includes('nation') ||
        lower.includes('state') || lower.includes('city') ||
        lower.includes('ancient') || lower.includes('century')) {
        return 'GEOGRAPHY_AND_HISTORY'
    }
    
    // Entertainment
    if (lower.includes('movie') || lower.includes('film') || 
        lower.includes('tv') || lower.includes('television') ||
        lower.includes('actor') || lower.includes('music') ||
        lower.includes('song') || lower.includes('singer') ||
        lower.includes('band') || lower.includes('celebrity') ||
        lower.includes('hollywood') || lower.includes('broadway')) {
        return 'ENTERTAINMENT'
    }
    
    // Arts & Literature
    if (lower.includes('art') || lower.includes('literature') || 
        lower.includes('book') || lower.includes('author') ||
        lower.includes('poet') || lower.includes('novel') ||
        lower.includes('painting') || lower.includes('sculpture') ||
        lower.includes('museum') || lower.includes('literary')) {
        return 'ARTS_AND_LITERATURE'
    }
    
    // Science & Nature
    if (lower.includes('science') || lower.includes('nature') || 
        lower.includes('animal') || lower.includes('biology') ||
        lower.includes('physics') || lower.includes('chemistry') ||
        lower.includes('math') || lower.includes('medicine') ||
        lower.includes('health') || lower.includes('space') ||
        lower.includes('planet') || lower.includes('element')) {
        return 'SCIENCE_AND_NATURE'
    }
    
    // Sports & Leisure
    if (lower.includes('sport') || lower.includes('game') || 
        lower.includes('olympic') || lower.includes('athlete') ||
        lower.includes('team') || lower.includes('baseball') ||
        lower.includes('football') || lower.includes('basketball') ||
        lower.includes('hockey') || lower.includes('soccer') ||
        lower.includes('golf') || lower.includes('tennis')) {
        return 'SPORTS_AND_LEISURE'
    }
    
    return 'GENERAL_KNOWLEDGE'
}

// ============================================================================
// Difficulty Classification
// ============================================================================

export function classifyDifficulty(value: number, round: JeopardyRound): 'EASY' | 'MEDIUM' | 'HARD' {
    if (round === 'FINAL') {
        return 'HARD'
    }
    
    if (round === 'DOUBLE') {
        // Double Jeopardy: $400, $800, $1200, $1600, $2000
        if (value <= 800) return 'EASY'
        if (value <= 1200) return 'MEDIUM'
        return 'HARD'
    }
    
    // Single Jeopardy: $200, $400, $600, $800, $1000
    if (value <= 400) return 'EASY'
    if (value <= 600) return 'MEDIUM'
    return 'HARD'
}

// ============================================================================
// Season Discovery (Dynamic - No Hardcoding)
// ============================================================================

/**
 * Discovers all available seasons from j-archive
 * This is the source of truth - no hardcoded season numbers
 */
export async function discoverSeasons(): Promise<number[]> {
    try {
        const response = await httpClient.get('/listseasons.php')
        const root = parse(response.data)
        
        const seasons: number[] = []
        const links = root.querySelectorAll('a')
        
        for (const link of links) {
            const href = link.getAttribute('href')
            if (href && href.includes('showseason.php?season=')) {
                const match = href.match(/season=(\d+)/)
                if (match) {
                    seasons.push(parseInt(match[1], 10))
                }
            }
        }
        
        // Sort descending (newest first)
        return seasons.sort((a, b) => b - a)
    } catch (error) {
        console.error('Error discovering seasons:', error)
        return []
    }
}

/**
 * Gets the current/latest season number by scraping the homepage
 */
export async function getCurrentSeason(): Promise<number | null> {
    try {
        const response = await httpClient.get('/')
        const root = parse(response.data)
        
        // Look for "current season" link
        const currentSeasonLink = root.querySelectorAll('a').find(el => 
            el.text.toLowerCase().includes('current season') ||
            el.getAttribute('href')?.includes('season=')
        )
        
        if (currentSeasonLink) {
            const href = currentSeasonLink.getAttribute('href')
            const match = href?.match(/season=(\d+)/)
            if (match) {
                return parseInt(match[1], 10)
            }
        }
        
        // Fallback: discover all seasons and return the highest
        const seasons = await discoverSeasons()
        return seasons.length > 0 ? seasons[0] : null
    } catch (error) {
        console.error('Error getting current season:', error)
        return null
    }
}

/**
 * Fetches all games for a given season
 */
export async function getSeasonGames(seasonNumber: number): Promise<SeasonGame[]> {
    try {
        const response = await httpClient.get(`/showseason.php?season=${seasonNumber}`)
        const root = parse(response.data)
        
        const games: SeasonGame[] = []
        const links = root.querySelectorAll('a')
        
        for (const link of links) {
            const href = link.getAttribute('href')
            const text = link.text.trim()
            const title = link.getAttribute('title')
            
            // Pattern: "#9428, aired 2025-11-05" with href "showgame.php?game_id=9305"
            if (href && href.includes('game_id=')) {
                const gameIdMatch = href.match(/game_id=(\d+)/)
                const showNumberMatch = text.match(/#(\d+)/)
                const airDateMatch = text.match(/aired\s+(\d{4}-\d{2}-\d{2})/)
                const tapedDateMatch = title?.match(/Taped\s+(\d{4}-\d{2}-\d{2})/)
                
                if (gameIdMatch && airDateMatch) {
                    games.push({
                        gameId: gameIdMatch[1],
                        showNumber: showNumberMatch ? showNumberMatch[1] : '',
                        airDate: airDateMatch[1],
                        tapedDate: tapedDateMatch ? tapedDateMatch[1] : null,
                        url: href.startsWith('http') ? href : `${J_ARCHIVE_BASE_URL}/${href}`
                    })
                }
            }
        }
        
        return games
    } catch (error) {
        console.error(`Error fetching season ${seasonNumber} games:`, error)
        return []
    }
}

// ============================================================================
// Game Lookup by Date (Dynamic Season Search)
// ============================================================================

/**
 * Finds a game ID by air date - searches seasons dynamically without hardcoding
 */
export async function findGameByDate(targetDate: string): Promise<SeasonGame | null> {
    // Extract year from target date
    const targetYear = parseInt(targetDate.split('-')[0], 10)
    
    // Get current season as starting point
    const currentSeason = await getCurrentSeason()
    if (!currentSeason) {
        console.error('Could not determine current season')
        return null
    }
    
    // Estimate which seasons to search based on year
    // Jeopardy seasons typically run Sep-Jul, season number roughly = year - 1984 + some adjustment
    // But we don't hardcode - we search dynamically
    
    // Start from current season and work backwards
    const maxSeasonsToSearch = 5
    let seasonsSearched = 0
    
    for (let season = currentSeason; season > 0 && seasonsSearched < maxSeasonsToSearch; season--) {
        console.log(`Searching season ${season} for date ${targetDate}...`)
        
        const games = await getSeasonGames(season)
        
        // Check if any game matches our date
        const match = games.find(g => g.airDate === targetDate)
        if (match) {
            console.log(`Found game ${match.gameId} for date ${targetDate} in season ${season}`)
            return match
        }
        
        // Check if we've gone too far back (year mismatch)
        // If the oldest game in this season is older than our target by more than 1 year, stop
        if (games.length > 0) {
            const oldestGame = games[games.length - 1]
            const oldestYear = parseInt(oldestGame.airDate.split('-')[0], 10)
            if (oldestYear < targetYear - 1) {
                console.log(`Season ${season} is too old (oldest: ${oldestYear}, target: ${targetYear})`)
                break
            }
        }
        
        seasonsSearched++
    }
    
    console.log(`No game found for date ${targetDate} after searching ${seasonsSearched} seasons`)
    return null
}

// ============================================================================
// Game Parsing
// ============================================================================

/**
 * Parses a single round (Single, Double, or Final Jeopardy) from the game HTML
 */
function parseRound(
    gameRoot: HTMLElement,
    roundSelector: string,
    roundType: JeopardyRound
): { categories: ParsedCategory[], questions: ParsedQuestion[] } {
    const categories: Map<string, ParsedCategory> = new Map()
    const questions: ParsedQuestion[] = []
    
    const roundElement = gameRoot.querySelector(roundSelector)
    if (!roundElement) {
        return { categories: [], questions: [] }
    }
    
    if (roundType === 'FINAL') {
        // Final Jeopardy has a different structure
        const categoryName = roundElement.querySelector('.category_name')?.text.trim() || 'Final Jeopardy'
        const clueText = roundElement.querySelector('.clue_text')?.text.trim()
        
        // Get answer from correct_response
        let answerText = ''
        const correctResponse = roundElement.querySelector('.correct_response')
        if (correctResponse) {
            answerText = correctResponse.text.trim()
        }
        
        if (clueText) {
            const question: ParsedQuestion = {
                question: clueText,
                answer: answerText || '[Answer not found]',
                value: 0, // Final Jeopardy has no fixed value
                category: categoryName,
                round: 'FINAL',
                difficulty: 'HARD',
                knowledgeCategory: classifyKnowledgeCategory(categoryName)
            }
            
            questions.push(question)
            categories.set(categoryName, {
                name: categoryName,
                round: 'FINAL',
                questions: [question]
            })
        }
        
        return { categories: Array.from(categories.values()), questions }
    }
    
    // Regular rounds (Single/Double)
    const roundPrefix = roundType === 'DOUBLE' ? 'DJ' : 'J'
    
    // Get category names
    const categoryNames: string[] = []
    roundElement.querySelectorAll('.category_name').forEach(el => {
        categoryNames.push(el.text.trim())
    })
    
    console.log(`Found ${categoryNames.length} categories in ${roundType} Jeopardy:`, categoryNames)
    
    // Parse clues by ID pattern: clue_{J|DJ}_{category}_{row}
    for (let categoryIdx = 1; categoryIdx <= 6; categoryIdx++) {
        const categoryName = categoryNames[categoryIdx - 1] || `Category ${categoryIdx}`
        
        if (!categories.has(categoryName)) {
            categories.set(categoryName, {
                name: categoryName,
                round: roundType,
                questions: []
            })
        }
        
        for (let rowIdx = 1; rowIdx <= 5; rowIdx++) {
            const clueId = `clue_${roundPrefix}_${categoryIdx}_${rowIdx}`
            const responseId = `${clueId}_r`
            
            const clueEl = gameRoot.querySelector(`#${clueId}`)
            if (!clueEl) continue
            
            const questionText = clueEl.text.trim()
            
            // Get answer from response element
            let answerText = ''
            const responseEl = gameRoot.querySelector(`#${responseId}`)
            if (responseEl) {
                const correctResponse = responseEl.querySelector('.correct_response')
                if (correctResponse) {
                    answerText = correctResponse.text.trim()
                }
            }
            
            // Calculate value based on row and round
            const baseValue = roundType === 'DOUBLE' ? 400 : 200
            const value = baseValue * rowIdx
            
            if (questionText) {
                const question: ParsedQuestion = {
                    question: questionText,
                    answer: answerText || '[Answer not found]',
                    value,
                    category: categoryName,
                    round: roundType,
                    difficulty: classifyDifficulty(value, roundType),
                    knowledgeCategory: classifyKnowledgeCategory(categoryName)
                }
                
                questions.push(question)
                categories.get(categoryName)!.questions.push(question)
            }
        }
    }
    
    return { categories: Array.from(categories.values()), questions }
}

/**
 * Extracts air date from game title
 * Title format: "Show #XXXX - Wednesday, November 5, 2025"
 */
function extractAirDateFromTitle(title: string): string | null {
    const dateMatch = title.match(/(\w+day),?\s+(\w+)\s+(\d+),?\s+(\d{4})/)
    if (dateMatch) {
        const months: Record<string, string> = {
            'January': '01', 'February': '02', 'March': '03', 'April': '04',
            'May': '05', 'June': '06', 'July': '07', 'August': '08',
            'September': '09', 'October': '10', 'November': '11', 'December': '12'
        }
        const monthNum = months[dateMatch[2]] || '01'
        const dayNum = dateMatch[3].padStart(2, '0')
        return `${dateMatch[4]}-${monthNum}-${dayNum}`
    }
    return null
}

/**
 * Extracts show number from game title
 */
function extractShowNumber(title: string): string | null {
    const match = title.match(/#(\d+)/)
    return match ? match[1] : null
}

/**
 * Parses a complete game from j-archive by game ID
 */
export async function parseGameById(gameId: string): Promise<ParsedGame | null> {
    try {
        const url = `/showgame.php?game_id=${gameId}`
        console.log(`Fetching game from: ${J_ARCHIVE_BASE_URL}${url}`)
        
        const response = await httpClient.get(url)
        const gameRoot = parse(response.data)
        
        // Extract metadata
        const title = gameRoot.querySelector('#game_title')?.text.trim() || 
                     gameRoot.querySelector('h1')?.text.trim() || ''
        
        const airDate = extractAirDateFromTitle(title)
        const showNumber = extractShowNumber(title)
        
        // Parse all rounds
        const singleResult = parseRound(gameRoot, '#jeopardy_round', 'SINGLE')
        const doubleResult = parseRound(gameRoot, '#double_jeopardy_round', 'DOUBLE')
        const finalResult = parseRound(gameRoot, '#final_jeopardy_round', 'FINAL')
        
        // Combine results
        const allCategories = [
            ...singleResult.categories,
            ...doubleResult.categories,
            ...finalResult.categories
        ]
        
        const allQuestions = [
            ...singleResult.questions,
            ...doubleResult.questions,
            ...finalResult.questions
        ]
        
        return {
            gameId,
            showNumber,
            airDate,
            title,
            categories: allCategories,
            questions: allQuestions,
            questionCount: allQuestions.length
        }
    } catch (error) {
        console.error(`Error parsing game ${gameId}:`, error)
        return null
    }
}

/**
 * Parses a game by air date
 */
export async function parseGameByDate(targetDate: string): Promise<ParsedGame | null> {
    const gameInfo = await findGameByDate(targetDate)
    if (!gameInfo) {
        return null
    }
    
    const game = await parseGameById(gameInfo.gameId)
    if (game && !game.airDate) {
        game.airDate = targetDate
    }
    
    return game
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Converts the legacy isDoubleJeopardy boolean to JeopardyRound
 */
export function legacyToRound(isDoubleJeopardy: boolean, isFinalJeopardy?: boolean): JeopardyRound {
    if (isFinalJeopardy) return 'FINAL'
    return isDoubleJeopardy ? 'DOUBLE' : 'SINGLE'
}

/**
 * Converts JeopardyRound to legacy isDoubleJeopardy boolean
 * Note: This loses Final Jeopardy information - use sparingly during migration
 */
export function roundToLegacy(round: JeopardyRound): { isDoubleJeopardy: boolean, isFinalJeopardy: boolean } {
    return {
        isDoubleJeopardy: round === 'DOUBLE',
        isFinalJeopardy: round === 'FINAL'
    }
}

/**
 * Validates a date string in YYYY-MM-DD format
 */
export function isValidDateFormat(date: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

/**
 * Checks if a date is in the future
 */
export function isFutureDate(date: string): boolean {
    const today = new Date().toISOString().split('T')[0]
    return date > today
}


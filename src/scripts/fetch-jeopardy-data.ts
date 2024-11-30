import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { load } from 'cheerio'

interface CategoryPattern {
    name: string;
    keywords: string[];
}

interface CategoryPatterns {
    [key: string]: CategoryPattern;
}

interface Question {
    question: string;
    answer: string;
    value: number;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    airDate: string;
    source: string;
}

interface Category {
    name: string;
    questions: Question[];
}

// Define our category patterns
const CATEGORY_PATTERNS: CategoryPatterns = {
    HISTORY: {
        name: 'HISTORY',
        keywords: ['war', 'president', 'king', 'queen', 'empire', 'revolution', 'dynasty', 'historical', 'reign', 'throne']
    },
    GEOGRAPHY: {
        name: 'GEOGRAPHY',
        keywords: ['country', 'capital', 'city', 'river', 'mountain', 'ocean', 'continent', 'island', 'state', 'region', 'peninsula']
    },
    SCIENCE: {
        name: 'SCIENCE',
        keywords: ['element', 'chemical', 'physics', 'biology', 'scientist', 'theory', 'atom', 'molecule', 'cell', 'discovery', 'experiment']
    },
    ARTS: {
        name: 'ARTS & CULTURE',
        keywords: ['painting', 'artist', 'museum', 'sculpture', 'composer', 'symphony', 'ballet', 'dance', 'opera', 'gallery', 'watercolor']
    },
    ENTERTAINMENT: {
        name: 'ENTERTAINMENT',
        keywords: ['movie', 'film', 'actor', 'actress', 'director', 'oscar', 'hollywood', 'tv', 'show', 'series', 'sitcom']
    },
    LITERATURE: {
        name: 'LITERATURE',
        keywords: ['author', 'novel', 'book', 'poet', 'writer', 'play', 'shakespeare', 'poem', 'literary', 'published', 'story']
    },
    SPORTS: {
        name: 'SPORTS',
        keywords: ['team', 'player', 'game', 'championship', 'olympic', 'sport', 'athlete', 'league', 'tournament', 'winner', 'match']
    },
    BUSINESS: {
        name: 'BUSINESS & ECONOMICS',
        keywords: ['company', 'business', 'stock', 'market', 'ceo', 'corporation', 'industry', 'trade', 'economic', 'financial', 'price']
    }
}

function determineDifficulty(value: number): 'EASY' | 'MEDIUM' | 'HARD' {
    if (value <= 400) return 'EASY'
    if (value <= 800) return 'MEDIUM'
    return 'HARD'
}

function categorizeQuestion(question: string, answer: string): string {
    // Combine question and answer text for analysis
    const text = `${question} ${answer}`.toLowerCase()

    // Score each category based on keyword matches
    const scores = Object.entries(CATEGORY_PATTERNS).map(([key, pattern]) => {
        const score = pattern.keywords.reduce((count, keyword) => {
            // Count how many times each keyword appears
            const regex = new RegExp(keyword.toLowerCase(), 'g')
            const matches = text.match(regex)
            return count + (matches ? matches.length : 0)
        }, 0)
        return { category: key, score }
    })

    // Sort by score and get the highest scoring category
    scores.sort((a, b) => b.score - a.score)

    // If no category has a score > 0, try additional patterns
    if (scores[0].score === 0) {
        // Check for dates which might indicate HISTORY
        if (text.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/) ||
            text.includes('century') ||
            text.includes('ancient') ||
            text.includes('dynasty')) {
            return 'HISTORY'
        }

        // Check for place names which might indicate GEOGRAPHY
        if (text.match(/\b(north|south|east|west|new|san|los|las)\b/i) ||
            text.includes('capital') ||
            text.includes('city') ||
            text.includes('country')) {
            return 'GEOGRAPHY'
        }

        // Default to GENERAL category if no clear match
        return 'GENERAL'
    }

    // Only return a category if it has a significantly higher score than the next best
    const bestScore = scores[0].score
    const nextBestScore = scores[1]?.score || 0

    if (bestScore > nextBestScore) {
        return scores[0].category
    }

    // If scores are tied or very close, default to GENERAL
    return 'GENERAL'
}

async function fetchWithRetry(url: string, retries = 3): Promise<string> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            })
            return response.data
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error instanceof Error ? error.message : 'Unknown error')
            if (i === retries - 1) throw error
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
        }
    }
    throw new Error('All retry attempts failed')
}

async function fetchGameIds(count = 50): Promise<string[]> {
    const baseUrl = 'https://j-archive.com/showseason.php?season='
    const gameIds = new Set<string>()
    let season = 38 // Recent season

    while (gameIds.size < count && season > 0) {
        try {
            console.log(`Fetching games from season ${season}...`)
            const html = await fetchWithRetry(`${baseUrl}${season}`)
            const $ = load(html)

            $('a[href*="game_id="]').each((_, el) => {
                const href = $(el).attr('href')
                if (href) {
                    const match = href.match(/game_id=(\d+)/)
                    if (match && match[1]) {
                        gameIds.add(match[1])
                    }
                }
            })

            console.log(`Found ${gameIds.size} games so far`)
        } catch (error) {
            console.error(`Error fetching season ${season}:`, error instanceof Error ? error.message : 'Unknown error')
        }
        season--
        await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return Array.from(gameIds).slice(0, count)
}

async function scrapeGame(gameId: string): Promise<Category[]> {
    try {
        console.log(`\nScraping game ${gameId}...`)
        const url = `https://j-archive.com/showgame.php?game_id=${gameId}`
        const html = await fetchWithRetry(url)
        const $ = load(html)

        // Initialize categories map
        const categorizedQuestions = new Map<string, Question[]>()
        Object.keys(CATEGORY_PATTERNS).concat(['GENERAL']).forEach(cat => {
            categorizedQuestions.set(cat, [])
        })

        // Find all clue text elements directly
        $('td[id^="clue_"][class="clue_text"]').each((_, clueText) => {
            const $clueText = $(clueText)
            const clueId = $clueText.attr('id')
            if (!clueId) return

            // Get the question text (from the main clue element)
            const question = $clueText.text().trim()

            // Get the answer text (from the _r element)
            const answerId = `${clueId}_r`
            const $answerElem = $(`#${answerId}`)
            let answer = ''

            if ($answerElem.length) {
                const correctResponseMatch = $answerElem.html()?.match(/<em class="correct_response">(.*?)<\/em>/i)
                if (correctResponseMatch) {
                    answer = correctResponseMatch[1]
                        .replace(/<\/?[^>]+(>|$)/g, '')
                        .replace(/&quot;/g, '"')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .trim()
                }
            }

            // Find the clue container to get the value
            const $clueContainer = $clueText.closest('tr').prev().find('.clue_value')
            const valueText = $clueContainer.text().trim()
            const value = parseInt(valueText.replace(/[^0-9]/g, '')) || 200

            if (question && answer) {
                // Determine the category based on content
                const category = categorizeQuestion(question, answer)
                const questions = categorizedQuestions.get(category)
                if (questions) {
                    questions.push({
                        question,
                        answer,
                        value,
                        difficulty: determineDifficulty(value),
                        airDate: new Date().toISOString(),
                        source: 'j-archive'
                    })
                }
            }
        })

        // Convert to our desired format and filter categories with enough questions
        const validCategories = Array.from(categorizedQuestions.entries())
            .filter(([_, questions]) => questions.length >= 3)
            .map(([category, questions]) => ({
                name: CATEGORY_PATTERNS[category]?.name || category,
                questions: questions.map(q => ({ ...q }))
            }))

        console.log(`\nFound ${validCategories.length} valid categories in game ${gameId}`)
        return validCategories
    } catch (error) {
        console.error(`Error scraping game ${gameId}:`, error instanceof Error ? error.message : 'Unknown error')
        return []
    }
}

async function main() {
    const args = process.argv.slice(2)
    const categoryCount = parseInt(args[0]) || 50
    const outputPath = args[1] || path.join(__dirname, '../../data/jeopardy-data.json')

    try {
        console.log('Fetching game IDs...')
        const gameIds = await fetchGameIds(Math.ceil(categoryCount / 6))
        console.log(`Found ${gameIds.length} games`)

        const allCategories: Category[] = []
        let gamesProcessed = 0

        for (const gameId of gameIds) {
            console.log(`Processing game ${++gamesProcessed}/${gameIds.length} (ID: ${gameId})`)
            const categories = await scrapeGame(gameId)
            allCategories.push(...categories)

            // Break if we have enough categories
            if (allCategories.length >= categoryCount * 2) {
                console.log('Reached sufficient category count for deduplication')
                break
            }

            await new Promise(resolve => setTimeout(resolve, 2000))
        }

        // Deduplicate questions across all categories
        const seenQuestions = new Set<string>()
        const deduplicatedCategories = allCategories.map(category => ({
            name: category.name,
            questions: category.questions.filter(q => {
                const key = `${q.question}|${q.answer}`
                if (seenQuestions.has(key)) return false
                seenQuestions.add(key)
                return true
            })
        }))
            .filter(cat => cat.questions.length >= 3)

        // Create directory if it doesn't exist
        const dir = path.dirname(outputPath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }

        // Save only the requested number of categories, ensuring no duplicates
        const uniqueCategories = Array.from(new Map(
            deduplicatedCategories.map(cat => [cat.name, cat])
        ).values())
        const finalData = uniqueCategories.slice(0, categoryCount)

        fs.writeFileSync(outputPath, JSON.stringify(finalData, null, 2))
        console.log(`Successfully saved ${finalData.length} categories to ${outputPath}`)
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error')
    }
}

if (require.main === module) {
    main()
} 
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const cheerio = require('cheerio')

// Define our category patterns
const CATEGORY_PATTERNS = {
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

function determineDifficulty(value) {
    if (value <= 400) return 'EASY'
    if (value <= 800) return 'MEDIUM'
    return 'HARD'
}

function categorizeQuestion(question, answer) {
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

async function fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            })
            return response.data
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error.message)
            if (i === retries - 1) throw error
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
        }
    }
}

async function fetchGameIds(count = 50) {
    const baseUrl = 'https://j-archive.com/showseason.php?season='
    const gameIds = new Set()
    let season = 38 // Recent season

    while (gameIds.size < count && season > 0) {
        try {
            console.log(`Fetching games from season ${season}...`)
            const html = await fetchWithRetry(`${baseUrl}${season}`)
            const $ = cheerio.load(html)

            $('a[href*="game_id="]').each((_, el) => {
                const href = $(el).attr('href')
                const match = href.match(/game_id=(\d+)/)
                if (match && match[1]) {
                    gameIds.add(match[1])
                }
            })

            console.log(`Found ${gameIds.size} games so far`)
        } catch (error) {
            console.error(`Error fetching season ${season}:`, error.message)
        }
        season--
        await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return Array.from(gameIds).slice(0, count)
}

async function scrapeGame(gameId) {
    try {
        console.log(`\nScraping game ${gameId}...`)
        const url = `https://j-archive.com/showgame.php?game_id=${gameId}`
        const html = await fetchWithRetry(url)
        const $ = cheerio.load(html)

        // Debug: Log the structure of the page
        console.log('\nPage structure:')
        console.log('Title:', $('.title').text())
        console.log('Game ID:', gameId)

        // Debug: Log the raw HTML of a clue to understand its structure
        const firstClue = $('.clue').first()
        if (firstClue.length) {
            console.log('\nExample clue HTML:')
            console.log(firstClue.html())
            console.log('\nClue text:', firstClue.find('.clue_text').text())
            console.log('Mouseover:', firstClue.find('.clue_text').attr('onmouseover'))
            console.log('Value:', firstClue.find('.clue_value').text())
        }

        // Debug: Count elements
        console.log('\nElement counts:')
        console.log('Categories found:', $('.category_name').length)
        console.log('Clues found:', $('.clue').length)
        console.log('Clue texts found:', $('.clue_text').length)
        console.log('Clue values found:', $('.clue_value').length)

        // Initialize categories map
        const categorizedQuestions = new Map(
            Object.keys(CATEGORY_PATTERNS).concat(['GENERAL']).map(cat => [cat, []])
        )

        // Process clues from both rounds
        $('#jeopardy_round, #double_jeopardy_round').each((_, round) => {
            const $round = $(round)
            console.log(`\nProcessing round: ${$round.attr('id')}`)

            // Debug: Log categories in this round
            console.log('Categories in round:')
            $round.find('.category_name').each((i, el) => {
                console.log(`  ${i + 1}:`, $(el).text().trim())
            })

            // Find all clue text elements directly
            $round.find('td[id^="clue_"][class="clue_text"]').each((_, clueText) => {
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

                    console.log('\nExtracted data:')
                    console.log('  Question:', question)
                    console.log('  Answer:', answer)
                    console.log('  Value:', value)
                    console.log('  Categorized as:', category)

                    categorizedQuestions.get(category).push({
                        question,
                        answer,
                        value,
                        difficulty: determineDifficulty(value),
                        airDate: new Date().toISOString(),
                        source: 'j-archive'
                    })
                } else {
                    console.log('\nSkipping clue - missing question or answer')
                    if (!question) console.log('  Missing question')
                    if (!answer) console.log('  Missing answer')
                }
            })
        })

        // Show category statistics
        console.log('\nCategory statistics:')
        for (const [category, questions] of categorizedQuestions.entries()) {
            console.log(`${category}: ${questions.length} questions`)
        }

        // Convert to our desired format and filter categories with enough questions
        const validCategories = Array.from(categorizedQuestions.entries())
            .filter(([_, questions]) => questions.length >= 3)
            .map(([category, questions]) => ({
                name: CATEGORY_PATTERNS[category]?.name || category,
                questions: questions.map(q => ({ ...q })) // Create a copy of each question
            }))

        // Deduplicate questions across categories
        const seenQuestions = new Set()
        validCategories.forEach(category => {
            category.questions = category.questions.filter(q => {
                const key = `${q.question}|${q.answer}`
                if (seenQuestions.has(key)) return false
                seenQuestions.add(key)
                return true
            })
        })

        // Only keep categories that still have enough questions after deduplication
        const finalCategories = validCategories.filter(cat => cat.questions.length >= 3)

        console.log(`\nFound ${finalCategories.length} valid categories in game ${gameId}`)
        return finalCategories
    } catch (error) {
        console.error(`Error scraping game ${gameId}:`, error.message)
        if (error.response) {
            console.error('Response status:', error.response.status)
            console.error('Response headers:', error.response.headers)
        }
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

        const processedData = []
        let gamesProcessed = 0

        for (const gameId of gameIds) {
            console.log(`Processing game ${++gamesProcessed}/${gameIds.length} (ID: ${gameId})`)
            const categories = await scrapeGame(gameId)
            processedData.push(...categories)

            console.log(`Total categories collected: ${processedData.length}`)

            // Break if we have enough categories
            if (processedData.length >= categoryCount) {
                console.log('Reached desired category count')
                break
            }

            await new Promise(resolve => setTimeout(resolve, 2000))
        }

        // Create directory if it doesn't exist
        const dir = path.dirname(outputPath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }

        // Save only the requested number of categories
        const finalData = processedData.slice(0, categoryCount)
        fs.writeFileSync(outputPath, JSON.stringify(finalData, null, 2))
        console.log(`Successfully saved ${finalData.length} categories to ${outputPath}`)
    } catch (error) {
        console.error('Error:', error)
    }
}

if (require.main === module) {
    main()
} 
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const cheerio = require('cheerio')

function determineDifficulty(value) {
    if (value <= 400) return 'EASY'
    if (value <= 800) return 'MEDIUM'
    return 'HARD'
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

            // Extract game IDs from links
            $('a[href*="game_id="]').each((_, el) => {
                const href = $(el).attr('href')
                const match = href.match(/game_id=(\d+)/)
                if (match && match[1]) {
                    gameIds.add(match[1])
                }
            })

            if (gameIds.size === 0) {
                console.log('No games found in season, trying different URL format...')
                // Try alternate URL format
                const alternateUrl = `https://j-archive.com/showseason.php?season=${season}`
                const alternateHtml = await fetchWithRetry(alternateUrl)
                const $alt = cheerio.load(alternateHtml)
                $alt('a[href*="game_id="]').each((_, el) => {
                    const href = $alt(el).attr('href')
                    const match = href.match(/game_id=(\d+)/)
                    if (match && match[1]) {
                        gameIds.add(match[1])
                    }
                })
            }

            console.log(`Found ${gameIds.size} games so far`)
        } catch (error) {
            console.error(`Error fetching season ${season}:`, error.message)
        }
        season--
        await new Promise(resolve => setTimeout(resolve, 1000)) // Rate limiting
    }

    return Array.from(gameIds).slice(0, count)
}

async function scrapeGame(gameId) {
    try {
        console.log(`Scraping game ${gameId}...`)
        const url = `https://j-archive.com/showgame.php?game_id=${gameId}`
        const html = await fetchWithRetry(url)
        const $ = cheerio.load(html)
        const categories = new Map()

        // Extract game date
        const titleText = $('.title').text()
        const dateMatch = titleText.match(/aired\s+(.+?)(?=,|$)/i)
        const gameDate = dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString()
        console.log(`Game aired on: ${gameDate}`)

        // Process each round (Jeopardy! and Double Jeopardy!)
        $('#jeopardy_round, #double_jeopardy_round').each((_, round) => {
            // Get categories
            $(round).find('.category_name').each((i, el) => {
                const categoryName = $(el).text().trim().toUpperCase()
                if (categoryName && !categories.has(categoryName)) {
                    categories.set(categoryName, {
                        name: categoryName,
                        questions: []
                    })
                    console.log(`Found category: ${categoryName}`)
                }
            })

            // Get clues for each category
            $(round).find('.clue').each((_, clue) => {
                const $clue = $(clue)
                const categoryName = $clue.closest('table').find('.category_name').text().trim().toUpperCase()
                const $text = $clue.find('.clue_text')
                const question = $text.text().trim()

                // Extract answer from mouseover text
                const mouseoverText = $text.attr('onmouseover') || ''
                const answerMatch = mouseoverText.match(/correct_response">(.*?)<\/em>/i)
                let answer = answerMatch ?
                    cheerio.load(answerMatch[1])('*').text().trim() :
                    ''

                // Clean up answer text
                answer = answer.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')

                // Extract value
                const valueText = $clue.find('.clue_value').text().trim()
                const value = parseInt(valueText.replace(/[^0-9]/g, '')) || 200

                if (categoryName && question && answer && categories.has(categoryName)) {
                    categories.get(categoryName).questions.push({
                        question,
                        answer,
                        value,
                        difficulty: determineDifficulty(value),
                        airDate: gameDate,
                        source: 'j-archive'
                    })
                    console.log(`Added question worth $${value} to ${categoryName}`)
                }
            })
        })

        // Filter and return categories with enough questions
        const validCategories = Array.from(categories.values())
            .filter(cat => cat.questions.length >= 3)
        console.log(`Found ${validCategories.length} valid categories in game ${gameId}`)
        return validCategories
    } catch (error) {
        console.error(`Error scraping game ${gameId}:`, error.message)
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

            // Add a small delay to avoid rate limiting
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
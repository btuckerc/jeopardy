import fs from 'fs'
import path from 'path'
import https from 'https'

interface JeopardyCategory {
    id: number
    title: string
    clues_count: number
}

interface JeopardyClue {
    id: number
    answer: string
    question: string
    value: number
    airdate: string
    category_id: number
    game_id: number
    invalid_count: number | null
}

interface JeopardyQuestion {
    id: number
    answer: string
    question: string
    value: number
    airdate: string
    category: {
        id: number
        title: string
        created_at: string
        updated_at: string
        clues_count: number
    }
}

function determineDifficulty(value: number): 'EASY' | 'MEDIUM' | 'HARD' {
    if (value <= 400) return 'EASY'
    if (value <= 800) return 'MEDIUM'
    return 'HARD'
}

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
        try {
            const data = await new Promise((resolve, reject) => {
                https.get(url, (res) => {
                    let data = ''
                    res.on('data', chunk => data += chunk)
                    res.on('end', () => {
                        try {
                            resolve(JSON.parse(data))
                        } catch (e) {
                            reject(e)
                        }
                    })
                }).on('error', reject)
            })
            return data
        } catch (error) {
            if (i === retries - 1) throw error
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
        }
    }
}

async function fetchCategories(offset: number = 0, count: number = 100): Promise<JeopardyCategory[]> {
    const url = `https://jservice.io/api/categories?count=${count}&offset=${offset}`
    return await fetchWithRetry(url)
}

async function fetchCluesForCategory(categoryId: number): Promise<JeopardyClue[]> {
    const url = `https://jservice.io/api/clues?category=${categoryId}`
    return await fetchWithRetry(url)
}

async function fetchRandomQuestions(count: number = 100): Promise<JeopardyQuestion[]> {
    const url = `https://jservice.io/api/random?count=${count}`
    return await fetchWithRetry(url)
}

interface ProcessedCategory {
    name: string
    questions: {
        question: string
        answer: string
        value: number
        difficulty: 'EASY' | 'MEDIUM' | 'HARD'
        airDate: string
        source: string
    }[]
}

async function processCategory(category: JeopardyCategory): Promise<ProcessedCategory | null> {
    try {
        const clues = await fetchCluesForCategory(category.id)

        // Filter out invalid clues
        const validClues = clues.filter(clue =>
            clue.question?.trim() &&
            clue.answer?.trim() &&
            clue.value > 0 &&
            (!clue.invalid_count || clue.invalid_count < 3)
        )

        if (validClues.length < 3) return null // Skip categories with too few valid clues

        const questions = validClues.map(clue => ({
            question: clue.question.trim(),
            answer: clue.answer.trim(),
            value: clue.value,
            difficulty: determineDifficulty(clue.value),
            airDate: clue.airdate,
            source: 'jservice.io'
        }))

        return {
            name: category.title.toUpperCase(),
            questions
        }
    } catch (error) {
        console.error(`Error processing category ${category.id}:`, error)
        return null
    }
}

async function main() {
    const args = process.argv.slice(2)
    const categoryCount = parseInt(args[0]) || 50
    const outputPath = args[1] || path.join(__dirname, '../../data/jeopardy-data.json')

    try {
        console.log('Fetching categories...')
        const categories = await fetchCategories(0, categoryCount)
        console.log(`Found ${categories.length} categories`)

        const processedData: ProcessedCategory[] = []

        for (let i = 0; i < categories.length; i++) {
            console.log(`Processing category ${i + 1}/${categories.length}: ${categories[i].title}`)
            const processed = await processCategory(categories[i])
            if (processed) {
                processedData.push(processed)
                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        }

        // Add some random questions to ensure variety
        console.log('Fetching additional random questions...')
        const randomQuestions = await fetchRandomQuestions(100)
        const randomCategories = new Map<string, ProcessedCategory>()

        randomQuestions.forEach(q => {
            if (!q.category?.title || !q.question || !q.answer || !q.value) return

            const categoryName = q.category.title.toUpperCase()
            if (!randomCategories.has(categoryName)) {
                randomCategories.set(categoryName, {
                    name: categoryName,
                    questions: []
                })
            }

            const category = randomCategories.get(categoryName)!
            category.questions.push({
                question: q.question.trim(),
                answer: q.answer.trim(),
                value: q.value,
                difficulty: determineDifficulty(q.value),
                airDate: q.airdate,
                source: 'jservice.io'
            })
        })

        // Add random categories with at least 3 questions
        randomCategories.forEach(category => {
            if (category.questions.length >= 3) {
                processedData.push(category)
            }
        })

        // Create directory if it doesn't exist
        const dir = path.dirname(outputPath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }

        fs.writeFileSync(outputPath, JSON.stringify(processedData, null, 2))
        console.log(`Successfully saved ${processedData.length} categories to ${outputPath}`)
    } catch (error) {
        console.error('Error:', error)
    }
}

if (require.main === module) {
    main()
} 
import fs from 'fs'
import path from 'path'
import https from 'https'

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

async function fetchQuestions(count: number = 100): Promise<JeopardyQuestion[]> {
    const questions: JeopardyQuestion[] = []
    const baseUrl = 'https://jservice.io/api/random'
    const batchSize = 100 // API limit per request

    console.log(`Fetching ${count} questions...`)

    for (let i = 0; i < count; i += batchSize) {
        const currentBatch = Math.min(batchSize, count - i)
        const url = `${baseUrl}?count=${currentBatch}`

        try {
            const data = await new Promise<JeopardyQuestion[]>((resolve, reject) => {
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

            questions.push(...data)
            console.log(`Fetched ${questions.length}/${count} questions`)

            // Add a small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (error) {
            console.error('Error fetching questions:', error)
            break
        }
    }

    return questions
}

function transformQuestions(questions: JeopardyQuestion[]) {
    return questions.map(q => ({
        category: q.category.title.toUpperCase(),
        question: q.question,
        answer: q.answer,
        value: q.value || undefined,
        airDate: q.airdate,
        source: 'jservice.io'
    }))
}

async function main() {
    const args = process.argv.slice(2)
    const count = parseInt(args[0]) || 100
    const outputPath = args[1] || path.join(__dirname, '../../data/jeopardy-questions.json')

    try {
        const questions = await fetchQuestions(count)
        const transformedQuestions = transformQuestions(questions)

        // Create directory if it doesn't exist
        const dir = path.dirname(outputPath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }

        fs.writeFileSync(outputPath, JSON.stringify(transformedQuestions, null, 2))
        console.log(`Successfully saved ${questions.length} questions to ${outputPath}`)
    } catch (error) {
        console.error('Error:', error)
    }
}

if (require.main === module) {
    main()
} 
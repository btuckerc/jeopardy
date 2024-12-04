import { PrismaClient, KnowledgeCategory } from '@prisma/client'
import path from 'path'
import fs from 'fs'

const prisma = new PrismaClient()

interface RawQuestion {
    category: string
    question: string
    answer: string
    value?: number
    airDate?: string
    source?: string
    knowledgeCategory?: KnowledgeCategory
}

async function loadQuestions(filePath: string) {
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        const questions: RawQuestion[] = Array.isArray(data) ? data : [data]

        console.log(`Processing ${questions.length} questions...`)

        // Group questions by category and air date
        const categoryGroups = new Map<string, Map<string, RawQuestion[]>>()
        questions.forEach(q => {
            const key = `${q.category}_${q.airDate || 'unknown'}`
            if (!categoryGroups.has(key)) {
                categoryGroups.set(key, new Map())
            }
            const dateGroup = categoryGroups.get(key)!

            // Group by air date
            const dateKey = q.airDate || 'unknown'
            if (!dateGroup.has(dateKey)) {
                dateGroup.set(dateKey, [])
            }
            dateGroup.get(dateKey)!.push(q)
        })

        // Process each category group
        for (const [categoryKey, dateGroups] of categoryGroups) {
            const categoryName = categoryKey.split('_')[0]

            // Find or create category
            const category = await prisma.category.upsert({
                where: { name: categoryName },
                create: { name: categoryName },
                update: {}
            })

            // Process each air date group
            for (const [_, groupQuestions] of dateGroups) {
                // Ensure all questions in the group share the same knowledge category
                const knowledgeCategory = groupQuestions[0].knowledgeCategory || KnowledgeCategory.GENERAL_KNOWLEDGE

                // Process questions in batches
                const batchSize = 100
                for (let i = 0; i < groupQuestions.length; i += batchSize) {
                    const batch = groupQuestions.slice(i, i + batchSize)
                    const createQuestions = batch.map(q => ({
                        question: q.question,
                        answer: q.answer,
                        value: q.value || determineDifficulty(q.value).value,
                        difficulty: determineDifficulty(q.value).difficulty,
                        airDate: q.airDate ? new Date(q.airDate) : null,
                        source: q.source || 'jeopardy_archive',
                        categoryId: category.id,
                        knowledgeCategory: knowledgeCategory
                    }))

                    await prisma.question.createMany({
                        data: createQuestions,
                        skipDuplicates: true
                    })
                }
            }

            console.log(`Processed category: ${categoryName}`)
        }

        console.log('Data import completed successfully')
    } catch (error) {
        console.error('Error importing data:', error)
        throw error
    }
}

function determineDifficulty(value: number | undefined): { difficulty: 'EASY' | 'MEDIUM' | 'HARD', value: number } {
    if (!value) {
        // Random value between 200 and 1000
        value = Math.floor(Math.random() * 800) + 200
    }

    if (value <= 400) return { difficulty: 'EASY', value }
    if (value <= 800) return { difficulty: 'MEDIUM', value }
    return { difficulty: 'HARD', value }
}

// Sample data for testing
const sampleData: RawQuestion[] = [
    {
        category: "SCIENCE & NATURE",
        question: "This element's atomic number 79 & symbol Au comes from the Latin word for 'shining dawn'",
        answer: "Gold",
        value: 400
    },
    {
        category: "SCIENCE & NATURE",
        question: "The speed of light is approximately 186,282 of these units per second",
        answer: "Miles",
        value: 600
    },
    {
        category: "BUSINESS & FINANCE",
        question: "This fruit-named tech company became the first U.S. company to reach a $1 trillion market cap",
        answer: "Apple",
        value: 800
    },
    {
        category: "BUSINESS & FINANCE",
        question: "TSLA is the stock symbol for this electric car company",
        answer: "Tesla",
        value: 400
    },
    {
        category: "GEOGRAPHY",
        question: "The United Kingdom consists of Great Britain & this island to its west",
        answer: "Ireland",
        value: 200
    }
]

// Function to load sample data
export async function loadSampleData() {
    const tempFile = path.join(__dirname, 'temp-sample-data.json')
    fs.writeFileSync(tempFile, JSON.stringify(sampleData))
    await loadQuestions(tempFile)
    fs.unlinkSync(tempFile)
}

// Function to load data from a file
export async function loadDataFromFile(filePath: string) {
    await loadQuestions(filePath)
}

// Function to clear all data (be careful with this!)
export async function clearAllData() {
    await prisma.gameHistory.deleteMany()
    await prisma.userProgress.deleteMany()
    await prisma.question.deleteMany()
    await prisma.category.deleteMany()
    console.log('All data cleared')
}

// Main function to run the script
async function main() {
    const args = process.argv.slice(2)
    const command = args[0]
    const filePath = args[1]

    try {
        switch (command) {
            case 'sample':
                await loadSampleData()
                break
            case 'load':
                if (!filePath) {
                    throw new Error('Please provide a file path')
                }
                await loadDataFromFile(filePath)
                break
            case 'clear':
                const confirmation = args[1] === '--confirm'
                if (!confirmation) {
                    console.log('Please add --confirm to clear all data')
                    break
                }
                await clearAllData()
                break
            default:
                console.log(`
Usage:
  npm run data-loader sample              # Load sample data
  npm run data-loader load [file-path]    # Load data from JSON file
  npm run data-loader clear --confirm     # Clear all data
        `)
        }
    } catch (error) {
        console.error('Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

if (require.main === module) {
    main()
} 
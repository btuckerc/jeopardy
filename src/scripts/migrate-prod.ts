// scripts/migrate-prod.ts
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import path from 'path'
import crypto from 'crypto'
import * as dotenv from 'dotenv'

// Load production environment variables
dotenv.config({ path: '.env.production' })

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required')
}

const prisma = new PrismaClient({
    log: ['error']
})

interface JeopardyQuestion {
    id: string
    question: string
    answer: string
    value: number
    category: string
    knowledgeCategory?: 'GEOGRAPHY_AND_HISTORY' | 'ENTERTAINMENT' | 'ARTS_AND_LITERATURE' | 'SCIENCE_AND_NATURE' | 'SPORTS_AND_LEISURE' | 'GENERAL_KNOWLEDGE'
    airDate?: string
    season?: number
    episodeId?: string
    wasTripleStumper?: boolean
    isDoubleJeopardy?: boolean
}

function determineDifficulty(value: number): 'EASY' | 'MEDIUM' | 'HARD' {
    if (value <= 200) return 'EASY'
    if (value <= 600) return 'MEDIUM'
    return 'HARD'
}

async function getOrCreateCategory(categoryName: string): Promise<string> {
    // Try to find existing category
    const existing = await prisma.category.findFirst({
        where: { name: categoryName },
        select: { id: true }
    })

    if (existing) {
        return existing.id
    }

    // Create new category if it doesn't exist
    const created = await prisma.category.create({
        data: {
            id: crypto.randomUUID(),
            name: categoryName
        },
        select: { id: true }
    })

    return created.id
}

async function main() {
    try {
        console.log('Starting production database migration...')

        // Test connection
        try {
            await prisma.$connect()
            console.log('Successfully connected to database')
        } catch (error) {
            console.error('Failed to connect to database:', error)
            process.exit(1)
        }

        // Read the scraped data
        const dataPath = path.join(process.cwd(), 'data', 'jeopardy_questions.json')
        console.log('Reading questions from:', dataPath)

        const rawData = readFileSync(dataPath, 'utf-8')
        const questions: JeopardyQuestion[] = JSON.parse(rawData)
        console.log(`Found ${questions.length} questions to process`)

        // Group questions by category
        const categoriesMap = new Map<string, JeopardyQuestion[]>()
        questions.forEach((q: JeopardyQuestion) => {
            const existing = categoriesMap.get(q.category) || []
            existing.push(q)
            categoriesMap.set(q.category, existing)
        })

        console.log(`Processing ${categoriesMap.size} categories`)

        // Process each category
        const batchSize = 100
        let processedCategories = 0
        // Track processed categories
        void 0 // totalQuestionsAdded tracking removed

        for (const [categoryName, categoryQuestions] of categoriesMap) {
            try {
                // Get or create category
                const categoryId = await getOrCreateCategory(categoryName)

                // Process questions in batches
                for (let i = 0; i < categoryQuestions.length; i += batchSize) {
                    const batch = categoryQuestions.slice(i, i + batchSize)

                    // Create questions with skipDuplicates
                    await prisma.question.createMany({
                        data: batch.map(q => ({
                            id: q.id,
                            question: q.question,
                            answer: q.answer,
                            value: q.value,
                            categoryId: categoryId,
                            knowledgeCategory: q.knowledgeCategory || 'GENERAL_KNOWLEDGE',
                            difficulty: determineDifficulty(q.value),
                            airDate: q.airDate ? new Date(q.airDate) : null,
                            season: q.season || null,
                            episodeId: q.episodeId || null,
                            wasTripleStumper: q.wasTripleStumper || false,
                            isDoubleJeopardy: q.isDoubleJeopardy || false
                        })),
                        skipDuplicates: true
                    })

                    console.log(`Processed ${i + batch.length}/${categoryQuestions.length} questions in ${categoryName}`)
                }

                processedCategories++
                console.log(`Completed category ${processedCategories}/${categoriesMap.size}: ${categoryName}`)

            } catch (error) {
                console.error(`Error processing category ${categoryName}:`, error)
                // Continue with next category
                continue
            }
        }

        console.log('Migration complete!')
        console.log(`Processed ${processedCategories}/${categoriesMap.size} categories`)

    } catch (error) {
        console.error('Error during migration:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()
    .catch((error) => {
        console.error('Error:', error)
        process.exit(1)
    })
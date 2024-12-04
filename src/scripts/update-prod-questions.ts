import { PrismaClient, Prisma } from '@prisma/client'
import { readFileSync } from 'fs'
import path from 'path'
import crypto from 'crypto'
import * as dotenv from 'dotenv'

// Load production environment variables
dotenv.config({ path: '.env.production' })

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required')
}

const MAX_RETRIES = 3
const RETRY_DELAY = 5000 // 5 seconds

const prisma = new PrismaClient({
    log: ['error'],
    // Add connection pooling settings
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    }
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

async function withRetry<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
    try {
        return await operation()
    } catch (error) {
        if (retries > 0) {
            console.log(`Operation failed, retrying in ${RETRY_DELAY / 1000} seconds... (${retries} retries left)`)
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
            return withRetry(operation, retries - 1)
        }
        throw error
    }
}

async function getOrCreateCategory(categoryName: string): Promise<string> {
    return withRetry(async () => {
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
    })
}

async function processCategoryBatch(
    batch: JeopardyQuestion[],
    categoryId: string
): Promise<{ added: number; skipped: number }> {
    return withRetry(async () => {
        // Check for existing questions to avoid duplicates
        const existingQuestions = await prisma.question.findMany({
            where: {
                OR: batch.map(q => ({
                    AND: {
                        question: q.question,
                        answer: q.answer,
                        categoryId: categoryId
                    }
                }))
            },
            select: { question: true }
        })

        const existingSet = new Set(existingQuestions.map(q => q.question))
        const newQuestions = batch.filter(q => !existingSet.has(q.question))

        if (newQuestions.length > 0) {
            // Use transaction for atomic operations
            await prisma.$transaction(async (prismaClient: Prisma.TransactionClient) => {
                await prismaClient.question.createMany({
                    data: newQuestions.map(q => ({
                        id: crypto.randomUUID(),
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
                    }))
                })
            })
        }

        return {
            added: newQuestions.length,
            skipped: batch.length - newQuestions.length
        }
    })
}

async function main() {
    try {
        console.log('Starting question update...')

        // Test connection with retry
        await withRetry(async () => {
            await prisma.$connect()
            console.log('Successfully connected to database')
        })

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
        const batchSize = 25 // Reduced batch size for better stability
        let processedCategories = 0
        let totalQuestionsAdded = 0
        let duplicatesSkipped = 0

        for (const [categoryName, categoryQuestions] of categoriesMap) {
            try {
                // Get or create category with retry
                const categoryId = await getOrCreateCategory(categoryName)

                // Process questions in smaller batches
                for (let i = 0; i < categoryQuestions.length; i += batchSize) {
                    const batch = categoryQuestions.slice(i, i + batchSize)
                    const { added, skipped } = await processCategoryBatch(batch, categoryId)

                    totalQuestionsAdded += added
                    duplicatesSkipped += skipped

                    console.log(`Processed ${i + batch.length}/${categoryQuestions.length} questions in ${categoryName}`)

                    // Add a small delay between batches to prevent overwhelming the connection
                    await new Promise(resolve => setTimeout(resolve, 100))
                }

                processedCategories++
                console.log(`Completed category ${processedCategories}/${categoriesMap.size}: ${categoryName}`)

            } catch (error) {
                console.error(`Error processing category ${categoryName}:`, error)
                // Retry the entire category on failure
                categoriesMap.set(categoryName, categoryQuestions)
                continue
            }
        }

        console.log('\nUpdate complete!')
        console.log(`Processed ${processedCategories}/${categoriesMap.size} categories`)
        console.log(`Added ${totalQuestionsAdded} new questions`)
        console.log(`Skipped ${duplicatesSkipped} duplicate questions`)

    } catch (error) {
        console.error('Error during update:', error)
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
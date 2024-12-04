import { PrismaClient, Prisma } from '@prisma/client'
import { readFileSync, writeFileSync, existsSync } from 'fs'
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

// Configure Prisma client with special connection handling for PgBouncer
const connectionString = process.env.DATABASE_URL || ''
const url = new URL(connectionString)
url.searchParams.set('pgbouncer', 'true')
url.searchParams.set('connection_limit', '1')
url.searchParams.set('pool_timeout', '20')
url.searchParams.set('statement_cache_size', '0')

const prisma = new PrismaClient({
    log: ['error'],
    datasources: {
        db: {
            url: url.toString()
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
        try {
            // Try to find existing category using parameterized query
            const result = await prisma.$transaction(async (tx) => {
                const existingCategories = await tx.$queryRawUnsafe<Array<{ id: string }>>(
                    'SELECT id FROM "Category" WHERE name = $1 LIMIT 1',
                    categoryName
                )

                if (existingCategories.length > 0) {
                    return existingCategories[0].id
                }

                // Create new category if it doesn't exist
                const newId = crypto.randomUUID()
                const now = new Date()
                await tx.$executeRawUnsafe(
                    'INSERT INTO "Category" (id, name, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4) ON CONFLICT (name) DO NOTHING',
                    newId,
                    categoryName,
                    now,
                    now
                )

                // Double-check if we got the category (in case of race condition)
                const finalCategories = await tx.$queryRawUnsafe<Array<{ id: string }>>(
                    'SELECT id FROM "Category" WHERE name = $1 LIMIT 1',
                    categoryName
                )

                return finalCategories[0]?.id || newId
            })

            return result
        } catch (error) {
            console.error('Error in getOrCreateCategory:', error)
            throw error
        }
    })
}

// Track processed categories to avoid reprocessing
const PROCESSED_CATEGORIES_FILE = path.join(process.cwd(), 'data', 'processed_categories.json')

function loadProcessedCategories(): Set<string> {
    try {
        if (existsSync(PROCESSED_CATEGORIES_FILE)) {
            const data = readFileSync(PROCESSED_CATEGORIES_FILE, 'utf-8')
            return new Set(JSON.parse(data))
        }
    } catch (error) {
        console.error('Error loading processed categories:', error)
    }
    return new Set()
}

function saveProcessedCategories(categories: Set<string>) {
    try {
        writeFileSync(PROCESSED_CATEGORIES_FILE, JSON.stringify(Array.from(categories), null, 2))
    } catch (error) {
        console.error('Error saving processed categories:', error)
    }
}

async function processCategoryBatch(
    batch: JeopardyQuestion[],
    categoryId: string,
    allQuestions: JeopardyQuestion[],
    dataPath: string
): Promise<{ added: number; skipped: number }> {
    return withRetry(async () => {
        try {
            // Check for existing questions using Prisma's built-in query
            const existingQuestions = await prisma.question.findMany({
                where: {
                    categoryId,
                    question: { in: batch.map(q => q.question) }
                },
                select: { question: true }
            })

            const existingSet = new Set(existingQuestions.map(q => q.question))
            const newQuestions = batch.filter(q => !existingSet.has(q.question))

            if (newQuestions.length > 0) {
                // Use transaction with Prisma's built-in createMany
                await prisma.$transaction(async (tx) => {
                    await tx.question.createMany({
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
                            isDoubleJeopardy: q.isDoubleJeopardy || false,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        })),
                        skipDuplicates: true
                    })
                })

                // Remove successfully added questions from the local file
                const successfulQuestions = new Set(newQuestions.map(q => q.question))
                const remainingQuestions = allQuestions.filter(q => !successfulQuestions.has(q.question))
                writeFileSync(dataPath, JSON.stringify(remainingQuestions, null, 2))

                console.log(`Added ${newQuestions.length} questions, ${remainingQuestions.length} remaining`)
            }

            return {
                added: newQuestions.length,
                skipped: batch.length - newQuestions.length
            }
        } catch (error) {
            console.error('Error in processCategoryBatch:', error)
            throw error
        }
    })
}

async function main() {
    try {
        console.log('Starting question update...')

        // Load processed categories
        const processedCategories = loadProcessedCategories()
        console.log(`Found ${processedCategories.size} previously processed categories`)

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
            if (!processedCategories.has(q.category)) {
                const existing = categoriesMap.get(q.category) || []
                existing.push(q)
                categoriesMap.set(q.category, existing)
            }
        })

        const remainingCategories = categoriesMap.size
        console.log(`Processing ${remainingCategories} remaining categories`)

        // Process each category
        const batchSize = 10 // Reduced batch size for better stability
        let processedCount = 0
        let totalQuestionsAdded = 0
        let duplicatesSkipped = 0

        for (const [categoryName, categoryQuestions] of categoriesMap) {
            try {
                // Get or create category with retry
                const categoryId = await getOrCreateCategory(categoryName)

                // Process questions in smaller batches
                for (let i = 0; i < categoryQuestions.length; i += batchSize) {
                    const batch = categoryQuestions.slice(i, i + batchSize)
                    const { added, skipped } = await processCategoryBatch(batch, categoryId, questions, dataPath)

                    totalQuestionsAdded += added
                    duplicatesSkipped += skipped

                    // Add a small delay between batches to prevent overwhelming the connection
                    await new Promise(resolve => setTimeout(resolve, 100))
                }

                processedCount++
                processedCategories.add(categoryName)
                saveProcessedCategories(processedCategories)

                console.log(`Completed category ${processedCount}/${remainingCategories}: ${categoryName}`)

            } catch (error) {
                console.error(`Error processing category ${categoryName}:`, error)
                continue
            }
        }

        console.log('\nUpdate complete!')
        console.log(`Processed ${processedCount}/${remainingCategories} categories`)
        console.log(`Added ${totalQuestionsAdded} new questions`)
        console.log(`Skipped ${duplicatesSkipped} duplicate questions`)
        console.log(`Total processed categories: ${processedCategories.size}`)

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
/**
 * Database Seeding Script
 * 
 * This script seeds the database from existing JSON files.
 * It's designed to be idempotent - running it multiple times won't create duplicates.
 * 
 * Features:
 * - Uses vector embeddings for semantic category inference (when OPENAI_API_KEY is set)
 * - Falls back to pattern matching when embeddings aren't available
 * - Deduplicates questions based on content hash
 * 
 * Usage:
 *   npx ts-node src/scripts/seed-database.ts [--file <path>] [--clear] [--dry-run] [--skip-embeddings]
 * 
 * Options:
 *   --file <path>      Path to JSON file (default: data/jeopardy_questions.json)
 *   --clear            Clear existing data before seeding (DANGER!)
 *   --dry-run          Show what would be done without making changes
 *   --skip-embeddings  Skip embedding generation (use existing knowledgeCategory or infer)
 */

import { PrismaClient, Difficulty, KnowledgeCategory } from '@prisma/client'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Types
interface RawQuestion {
    id?: string
    question: string
    answer: string
    value: number
    category: string
    knowledgeCategory?: string
    airDate?: string
    season?: number
    episodeId?: string
    wasTripleStumper?: boolean
    isDoubleJeopardy?: boolean
}

interface IngestionStats {
    totalInFile: number
    categoriesCreated: number
    categoriesExisted: number
    questionsCreated: number
    questionsSkipped: number
    embeddingsGenerated: number
    categoriesInferred: number
    errors: number
    startTime: Date
    endTime?: Date
}

// Lazy load embeddings module to avoid errors when OpenAI isn't configured
let embeddingsModule: typeof import('../lib/embeddings') | null = null

async function getEmbeddingsModule() {
    if (!embeddingsModule) {
        embeddingsModule = await import('../lib/embeddings')
    }
    return embeddingsModule
}

// Configuration
const BATCH_SIZE = 100
const LOG_INTERVAL = 500
const EMBEDDING_BATCH_SIZE = 50 // Smaller batches for embedding generation

// Prisma client with connection handling
function createPrismaClient(): PrismaClient {
    const connectionString = process.env.DATABASE_URL || ''
    
    // Handle PgBouncer if needed
    if (connectionString.includes('supabase') || connectionString.includes('pooler')) {
        const url = new URL(connectionString)
        url.searchParams.set('pgbouncer', 'true')
        url.searchParams.set('connection_limit', '1')
        url.searchParams.set('pool_timeout', '20')
        
        return new PrismaClient({
            log: ['error', 'warn'],
            datasources: {
                db: { url: url.toString() }
            }
        })
    }
    
    return new PrismaClient({
        log: ['error', 'warn']
    })
}

// Utility functions
function determineDifficulty(value: number): Difficulty {
    if (value <= 400) return 'EASY'
    if (value <= 800) return 'MEDIUM'
    return 'HARD'
}

function normalizeKnowledgeCategory(category?: string): KnowledgeCategory {
    if (!category) return 'GENERAL_KNOWLEDGE'
    
    const normalized = category.toUpperCase().replace(/ /g, '_')
    const validCategories: KnowledgeCategory[] = [
        'GEOGRAPHY_AND_HISTORY',
        'ENTERTAINMENT',
        'ARTS_AND_LITERATURE',
        'SCIENCE_AND_NATURE',
        'SPORTS_AND_LEISURE',
        'GENERAL_KNOWLEDGE'
    ]
    
    return validCategories.includes(normalized as KnowledgeCategory) 
        ? normalized as KnowledgeCategory 
        : 'GENERAL_KNOWLEDGE'
}

/**
 * Load knowledge category embeddings from database
 */
async function loadCategoryEmbeddings(prisma: PrismaClient): Promise<Map<KnowledgeCategory, number[]> | null> {
    try {
        const embeddings = await prisma.$queryRaw<Array<{
            knowledgeCategory: KnowledgeCategory
            embedding: string
        }>>`
            SELECT "knowledgeCategory", embedding::text 
            FROM "KnowledgeCategoryEmbedding"
        `
        
        if (embeddings.length === 0) {
            return null
        }
        
        const embeddingsModule = await getEmbeddingsModule()
        const map = new Map<KnowledgeCategory, number[]>()
        
        for (const row of embeddings) {
            map.set(row.knowledgeCategory, embeddingsModule.fromSql(row.embedding))
        }
        
        return map
    } catch (error) {
        console.log('   Note: Could not load category embeddings, will use pattern matching')
        return null
    }
}

function generateQuestionHash(question: RawQuestion): string {
    // Create a hash based on question text, answer, and category to detect duplicates
    const content = `${question.question}|${question.answer}|${question.category}`.toLowerCase()
    return crypto.createHash('md5').update(content).digest('hex')
}

// Main seeding function
async function seedDatabase(options: {
    filePath: string
    clear: boolean
    dryRun: boolean
    skipEmbeddings: boolean
}): Promise<IngestionStats> {
    const stats: IngestionStats = {
        totalInFile: 0,
        categoriesCreated: 0,
        categoriesExisted: 0,
        questionsCreated: 0,
        questionsSkipped: 0,
        embeddingsGenerated: 0,
        categoriesInferred: 0,
        errors: 0,
        startTime: new Date()
    }
    
    console.log('🚀 Starting database seed...')
    console.log(`   File: ${options.filePath}`)
    console.log(`   Clear: ${options.clear}`)
    console.log(`   Dry Run: ${options.dryRun}`)
    console.log(`   Skip Embeddings: ${options.skipEmbeddings}`)
    console.log('')
    
    // Validate file exists
    if (!existsSync(options.filePath)) {
        throw new Error(`File not found: ${options.filePath}`)
    }
    
    // Read and parse JSON
    console.log('📖 Reading JSON file...')
    const rawData = readFileSync(options.filePath, 'utf-8')
    const questions: RawQuestion[] = JSON.parse(rawData)
    stats.totalInFile = questions.length
    console.log(`   Found ${questions.length.toLocaleString()} questions`)
    
    if (options.dryRun) {
        console.log('\n🔍 DRY RUN - No changes will be made')
        
        // Analyze the data
        const categories = new Set(questions.map(q => q.category))
        const knowledgeCategories = new Map<string, number>()
        const dateRange = { min: '', max: '' }
        
        questions.forEach(q => {
            const kc = normalizeKnowledgeCategory(q.knowledgeCategory)
            knowledgeCategories.set(kc, (knowledgeCategories.get(kc) || 0) + 1)
            
            if (q.airDate) {
                if (!dateRange.min || q.airDate < dateRange.min) dateRange.min = q.airDate
                if (!dateRange.max || q.airDate > dateRange.max) dateRange.max = q.airDate
            }
        })
        
        console.log(`\n📊 Data Analysis:`)
        console.log(`   Unique categories: ${categories.size.toLocaleString()}`)
        console.log(`   Date range: ${dateRange.min || 'N/A'} to ${dateRange.max || 'N/A'}`)
        console.log(`   Knowledge categories:`)
        knowledgeCategories.forEach((count, kc) => {
            console.log(`     - ${kc}: ${count.toLocaleString()}`)
        })
        
        stats.endTime = new Date()
        return stats
    }
    
    // Initialize Prisma
    const prisma = createPrismaClient()
    
    try {
        await prisma.$connect()
        console.log('✅ Connected to database')
        
        // Load category embeddings for semantic inference
        let categoryEmbeddings: Map<KnowledgeCategory, number[]> | null = null
        let embeddingsModule: typeof import('../lib/embeddings') | null = null
        
        if (!options.skipEmbeddings && process.env.OPENAI_API_KEY) {
            console.log('\n🧠 Loading knowledge category embeddings...')
            categoryEmbeddings = await loadCategoryEmbeddings(prisma)
            if (categoryEmbeddings) {
                embeddingsModule = await getEmbeddingsModule()
                console.log(`   Loaded ${categoryEmbeddings.size} category embeddings`)
                console.log('   Will use semantic inference for category classification')
            } else {
                console.log('   No embeddings found, run db:seed:embeddings first for better inference')
            }
        } else if (!options.skipEmbeddings) {
            console.log('\n⚠️  OPENAI_API_KEY not set, skipping semantic inference')
        }
        
        // Clear existing data if requested
        if (options.clear) {
            console.log('\n⚠️  Clearing existing data...')
            await prisma.gameQuestion.deleteMany({})
            await prisma.game.deleteMany({})
            await prisma.userProgress.deleteMany({})
            await prisma.gameHistory.deleteMany({})
            await prisma.question.deleteMany({})
            await prisma.category.deleteMany({})
            await prisma.tag.deleteMany({})
            console.log('   Data cleared')
        }
        
        // Group questions by category
        console.log('\n📦 Grouping questions by category...')
        const categoriesMap = new Map<string, RawQuestion[]>()
        questions.forEach(q => {
            const existing = categoriesMap.get(q.category) || []
            existing.push(q)
            categoriesMap.set(q.category, existing)
        })
        console.log(`   ${categoriesMap.size.toLocaleString()} unique categories`)
        
        // Get existing categories for deduplication
        console.log('\n🔍 Checking existing categories...')
        const existingCategories = await prisma.category.findMany({
            select: { id: true, name: true }
        })
        const categoryNameToId = new Map(existingCategories.map(c => [c.name, c.id]))
        console.log(`   ${existingCategories.length.toLocaleString()} categories already in database`)
        
        // Get existing question hashes for deduplication
        console.log('🔍 Building deduplication index...')
        const existingQuestions = await prisma.question.findMany({
            select: { question: true, answer: true, categoryId: true }
        })
        const existingHashes = new Set(
            existingQuestions.map(q => {
                const cat = existingCategories.find(c => c.id === q.categoryId)
                return crypto.createHash('md5')
                    .update(`${q.question}|${q.answer}|${cat?.name || ''}`.toLowerCase())
                    .digest('hex')
            })
        )
        console.log(`   ${existingHashes.size.toLocaleString()} existing questions indexed`)
        
        // Process each category
        console.log('\n📝 Processing categories and questions...')
        let processedQuestions = 0
        
        for (const [categoryName, categoryQuestions] of categoriesMap) {
            try {
                // Get or create category
                let categoryId = categoryNameToId.get(categoryName)
                
                if (!categoryId) {
                    const newCategory = await prisma.category.create({
                        data: {
                            id: crypto.randomUUID(),
                            name: categoryName
                        }
                    })
                    categoryId = newCategory.id
                    categoryNameToId.set(categoryName, categoryId)
                    stats.categoriesCreated++
                } else {
                    stats.categoriesExisted++
                }
                
                // Filter out duplicates
                const newQuestions = categoryQuestions.filter(q => {
                    const hash = generateQuestionHash(q)
                    if (existingHashes.has(hash)) {
                        stats.questionsSkipped++
                        return false
                    }
                    existingHashes.add(hash) // Prevent duplicates within same batch
                    return true
                })
                
                // Infer knowledge categories using embeddings if available
                let inferredCategories: Map<number, KnowledgeCategory> = new Map()
                
                if (categoryEmbeddings && embeddingsModule) {
                    // Find questions that need inference (no knowledgeCategory or GENERAL_KNOWLEDGE)
                    const needsInference = newQuestions
                        .map((q, idx) => ({ q, idx }))
                        .filter(({ q }) => !q.knowledgeCategory || q.knowledgeCategory === 'GENERAL_KNOWLEDGE')
                    
                    if (needsInference.length > 0) {
                        // Process in smaller batches for embedding generation
                        for (let i = 0; i < needsInference.length; i += EMBEDDING_BATCH_SIZE) {
                            const batch = needsInference.slice(i, i + EMBEDDING_BATCH_SIZE)
                            
                            try {
                                const results = await embeddingsModule.batchInferKnowledgeCategories(
                                    batch.map(({ q }) => ({
                                        categoryName: categoryName,
                                        question: q.question,
                                        answer: q.answer
                                    })),
                                    categoryEmbeddings
                                )
                                
                                results.forEach((result, batchIdx) => {
                                    const originalIdx = batch[batchIdx].idx
                                    // Only use inferred category if confidence is reasonable
                                    if (result.confidence > 0.3) {
                                        inferredCategories.set(originalIdx, result.category)
                                        stats.categoriesInferred++
                                    }
                                })
                            } catch (error) {
                                console.log(`   Warning: Could not infer categories for batch: ${error}`)
                            }
                        }
                    }
                }
                
                // Process questions in batches
                for (let i = 0; i < newQuestions.length; i += BATCH_SIZE) {
                    const batch = newQuestions.slice(i, i + BATCH_SIZE)
                    
                    await prisma.question.createMany({
                        data: batch.map((q, batchIdx) => {
                            const originalIdx = i + batchIdx
                            // Use inferred category if available, otherwise use existing or normalize
                            const knowledgeCategory = inferredCategories.get(originalIdx) 
                                || normalizeKnowledgeCategory(q.knowledgeCategory)
                            
                            return {
                                id: q.id || crypto.randomUUID(),
                                question: q.question,
                                answer: q.answer,
                                value: q.value,
                                categoryId: categoryId!,
                                knowledgeCategory,
                                difficulty: determineDifficulty(q.value),
                                airDate: q.airDate ? new Date(q.airDate) : null,
                                season: q.season || null,
                                episodeId: q.episodeId || null,
                                wasTripleStumper: q.wasTripleStumper || false,
                                isDoubleJeopardy: q.isDoubleJeopardy || false
                            }
                        }),
                        skipDuplicates: true
                    })
                    
                    stats.questionsCreated += batch.length
                }
                
                processedQuestions += categoryQuestions.length
                
                // Log progress
                if (processedQuestions % LOG_INTERVAL === 0) {
                    const progress = ((processedQuestions / questions.length) * 100).toFixed(1)
                    console.log(`   Progress: ${progress}% (${processedQuestions.toLocaleString()}/${questions.length.toLocaleString()})`)
                }
                
            } catch (error) {
                console.error(`   ❌ Error processing category "${categoryName}":`, error)
                stats.errors++
            }
        }
        
        stats.endTime = new Date()
        
        // Print summary
        const duration = (stats.endTime.getTime() - stats.startTime.getTime()) / 1000
        console.log('\n' + '='.repeat(50))
        console.log('📊 SEEDING COMPLETE')
        console.log('='.repeat(50))
        console.log(`   Duration: ${duration.toFixed(1)}s`)
        console.log(`   Questions in file: ${stats.totalInFile.toLocaleString()}`)
        console.log(`   Categories created: ${stats.categoriesCreated.toLocaleString()}`)
        console.log(`   Categories existed: ${stats.categoriesExisted.toLocaleString()}`)
        console.log(`   Questions created: ${stats.questionsCreated.toLocaleString()}`)
        console.log(`   Questions skipped (duplicates): ${stats.questionsSkipped.toLocaleString()}`)
        if (stats.categoriesInferred > 0) {
            console.log(`   Categories inferred (via embeddings): ${stats.categoriesInferred.toLocaleString()}`)
        }
        console.log(`   Errors: ${stats.errors}`)
        console.log('='.repeat(50))
        
        return stats
        
    } finally {
        await prisma.$disconnect()
    }
}

// CLI
async function main() {
    const args = process.argv.slice(2)
    
    const options = {
        filePath: path.join(process.cwd(), 'data/jeopardy_questions.json'),
        clear: false,
        dryRun: false,
        skipEmbeddings: false
    }
    
    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--file':
                options.filePath = args[++i]
                break
            case '--clear':
                options.clear = true
                break
            case '--dry-run':
                options.dryRun = true
                break
            case '--skip-embeddings':
                options.skipEmbeddings = true
                break
            case '--help':
                console.log(`
Database Seeding Script

Usage:
  npx ts-node src/scripts/seed-database.ts [options]

Options:
  --file <path>      Path to JSON file (default: data/jeopardy_questions.json)
  --clear            Clear existing data before seeding (DANGER!)
  --dry-run          Show what would be done without making changes
  --skip-embeddings  Skip semantic category inference (faster, uses existing categories)
  --help             Show this help message

Environment:
  OPENAI_API_KEY     Required for semantic category inference
  DATABASE_URL       PostgreSQL connection string
                `)
                process.exit(0)
        }
    }
    
    // Confirm clear operation
    if (options.clear && !options.dryRun) {
        console.log('\n⚠️  WARNING: This will DELETE all existing data!')
        console.log('   Press Ctrl+C within 5 seconds to cancel...\n')
        await new Promise(resolve => setTimeout(resolve, 5000))
    }
    
    try {
        await seedDatabase(options)
        process.exit(0)
    } catch (error) {
        console.error('\n❌ Seeding failed:', error)
        process.exit(1)
    }
}

main()


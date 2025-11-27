/**
 * Seed Knowledge Category Embeddings
 * 
 * This script creates reference embeddings for each knowledge category.
 * These embeddings are used to semantically classify questions into categories.
 * 
 * Usage:
 *   npx ts-node src/scripts/seed-knowledge-embeddings.ts
 * 
 * Requires:
 *   - OPENAI_API_KEY environment variable
 *   - pgvector extension enabled in database
 */

import { PrismaClient, KnowledgeCategory } from '@prisma/client'
import { generateEmbedding, KNOWLEDGE_CATEGORY_DESCRIPTIONS, toSql } from '../lib/embeddings'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const prisma = new PrismaClient()

const KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = [
    'GEOGRAPHY_AND_HISTORY',
    'ENTERTAINMENT',
    'ARTS_AND_LITERATURE',
    'SCIENCE_AND_NATURE',
    'SPORTS_AND_LEISURE',
    'GENERAL_KNOWLEDGE'
]

async function main() {
    console.log('🚀 Seeding knowledge category embeddings...\n')
    
    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY environment variable is required')
        process.exit(1)
    }
    
    try {
        await prisma.$connect()
        console.log('✅ Connected to database\n')
        
        // Enable pgvector extension if not already enabled
        console.log('📦 Ensuring pgvector extension is enabled...')
        await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector')
        console.log('   Done\n')
        
        // Process each knowledge category
        for (const category of KNOWLEDGE_CATEGORIES) {
            console.log(`📝 Processing ${category}...`)
            
            const description = KNOWLEDGE_CATEGORY_DESCRIPTIONS[category]
            
            try {
                // Generate embedding for the category description
                const embedding = await generateEmbedding(description)
                const embeddingSql = toSql(embedding)
                
                // Upsert the embedding
                await prisma.$executeRawUnsafe(`
                    INSERT INTO "KnowledgeCategoryEmbedding" (
                        id, 
                        "knowledgeCategory", 
                        description, 
                        embedding, 
                        "createdAt", 
                        "updatedAt"
                    )
                    VALUES (
                        gen_random_uuid(),
                        $1::"KnowledgeCategory",
                        $2,
                        $3::vector,
                        NOW(),
                        NOW()
                    )
                    ON CONFLICT ("knowledgeCategory") 
                    DO UPDATE SET 
                        description = EXCLUDED.description,
                        embedding = EXCLUDED.embedding,
                        "updatedAt" = NOW()
                `, category, description, embeddingSql)
                
                console.log(`   ✓ Created embedding (${embedding.length} dimensions)`)
                
            } catch (error) {
                console.error(`   ✗ Error processing ${category}:`, error)
            }
            
            // Small delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 200))
        }
        
        // Verify results
        const count = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count FROM "KnowledgeCategoryEmbedding"
        `
        
        console.log('\n' + '='.repeat(50))
        console.log('📊 SEEDING COMPLETE')
        console.log('='.repeat(50))
        console.log(`   Knowledge categories seeded: ${count[0].count}`)
        console.log('='.repeat(50))
        
    } catch (error) {
        console.error('❌ Error seeding embeddings:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()


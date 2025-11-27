/**
 * Script to create HNSW vector indexes for pgvector
 * 
 * Run this script to create optimized indexes for vector similarity search.
 * These indexes use HNSW (Hierarchical Navigable Small World) algorithm
 * which provides fast approximate nearest neighbor search.
 * 
 * Usage: npx ts-node src/scripts/create-vector-indexes.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createVectorIndexes() {
    console.log('Creating HNSW vector indexes...\n')

    try {
        // Check if pgvector extension is installed
        const extensionCheck = await prisma.$queryRaw<Array<{ extname: string }>>`
            SELECT extname FROM pg_extension WHERE extname = 'vector';
        `
        
        if (extensionCheck.length === 0) {
            console.log('Installing pgvector extension...')
            await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector;`
            console.log('✓ pgvector extension installed\n')
        } else {
            console.log('✓ pgvector extension already installed\n')
        }

        // Create Question embedding index
        console.log('Creating Question embedding HNSW index...')
        await prisma.$executeRaw`
            CREATE INDEX IF NOT EXISTS "question_embedding_hnsw_idx" 
            ON "Question" 
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
        `
        console.log('✓ Question embedding index created\n')

        // Create Category embedding index
        console.log('Creating Category embedding HNSW index...')
        await prisma.$executeRaw`
            CREATE INDEX IF NOT EXISTS "category_embedding_hnsw_idx" 
            ON "Category" 
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
        `
        console.log('✓ Category embedding index created\n')

        // Create KnowledgeCategoryEmbedding index
        console.log('Creating KnowledgeCategoryEmbedding HNSW index...')
        await prisma.$executeRaw`
            CREATE INDEX IF NOT EXISTS "knowledge_category_embedding_hnsw_idx" 
            ON "KnowledgeCategoryEmbedding" 
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
        `
        console.log('✓ KnowledgeCategoryEmbedding index created\n')

        // Verify indexes were created
        console.log('Verifying indexes...')
        const indexes = await prisma.$queryRaw<Array<{ indexname: string, indexdef: string }>>`
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE indexname LIKE '%embedding%hnsw%';
        `
        
        console.log('\nCreated indexes:')
        indexes.forEach(idx => {
            console.log(`  - ${idx.indexname}`)
        })

        console.log('\n✅ All HNSW vector indexes created successfully!')
        console.log('\nThese indexes will significantly speed up vector similarity searches.')
        console.log('Index parameters:')
        console.log('  - m = 16: Bi-directional links per node (balances speed and recall)')
        console.log('  - ef_construction = 64: Build-time candidate list size (higher = better recall)')

    } catch (error) {
        console.error('Error creating vector indexes:', error)
        throw error
    }
}

async function main() {
    try {
        await createVectorIndexes()
    } catch (error) {
        console.error('Failed to create vector indexes:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()


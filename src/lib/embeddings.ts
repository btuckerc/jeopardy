/**
 * Embeddings Service
 * 
 * Provides semantic embeddings using OpenAI's text-embedding-3-small model.
 * Used for:
 * - Inferring knowledge categories for questions
 * - Finding semantically similar questions
 * - Category classification
 */

import OpenAI from 'openai'
import { KnowledgeCategory } from '@prisma/client'
import * as pgvector from 'pgvector'

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

// Embedding model configuration
const EMBEDDING_MODEL = 'text-embedding-3-small'
const _EMBEDDING_DIMENSIONS = 1536 // Reserved for future use

// Rate limiting
const BATCH_SIZE = 100 // OpenAI allows up to 2048 inputs per request
const RATE_LIMIT_DELAY = 100 // ms between batches

/**
 * Knowledge category descriptions for embedding comparison
 * These are used to create reference embeddings for category inference
 */
export const KNOWLEDGE_CATEGORY_DESCRIPTIONS: Record<KnowledgeCategory, string> = {
    GEOGRAPHY_AND_HISTORY: `Geography, world history, ancient civilizations, historical events, wars, treaties, 
        countries, capitals, continents, rivers, mountains, oceans, maps, exploration, 
        presidents, emperors, dynasties, empires, revolutions, colonial history, 
        medieval times, renaissance, world wars, civil wars, archaeology`,
    
    ENTERTAINMENT: `Movies, films, cinema, actors, actresses, directors, Hollywood, 
        television shows, TV series, sitcoms, dramas, reality TV, streaming, 
        music, songs, albums, bands, singers, musicians, concerts, 
        Grammy awards, Oscar awards, Emmy awards, Golden Globes, 
        pop culture, celebrities, entertainment industry`,
    
    ARTS_AND_LITERATURE: `Literature, novels, books, authors, writers, poets, poetry, 
        plays, playwrights, Shakespeare, classic literature, modern fiction, 
        art, artists, paintings, sculptures, museums, galleries, 
        renaissance art, impressionism, modern art, contemporary art, 
        architecture, dance, theater, opera, classical music composers`,
    
    SCIENCE_AND_NATURE: `Science, biology, chemistry, physics, astronomy, geology, 
        scientists, experiments, discoveries, inventions, technology, 
        elements, molecules, atoms, cells, genes, DNA, evolution, 
        animals, plants, wildlife, ecosystems, habitats, nature, 
        environment, climate, weather, space, planets, stars, universe, 
        medicine, health, diseases, anatomy`,
    
    SPORTS_AND_LEISURE: `Sports, athletics, games, competitions, tournaments, 
        baseball, football, basketball, soccer, tennis, golf, hockey, 
        Olympics, medals, championships, World Cup, Super Bowl, 
        athletes, players, teams, coaches, stadiums, records, 
        hobbies, recreation, leisure activities, board games, 
        outdoor activities, fitness, exercise`,
    
    GENERAL_KNOWLEDGE: `General knowledge, trivia, miscellaneous facts, 
        everyday knowledge, common knowledge, random facts, 
        food and drink, fashion, business, economics, 
        language, words, vocabulary, etymology, 
        holidays, traditions, customs, culture`
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000), // Limit input length
        encoding_format: 'float'
    })
    
    return response.data[0].embedding
}

/**
 * Generate embeddings for multiple texts in batches
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = []
    
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE)
        const truncatedBatch = batch.map(t => t.slice(0, 8000))
        
        const response = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: truncatedBatch,
            encoding_format: 'float'
        })
        
        embeddings.push(...response.data.map(d => d.embedding))
        
        // Rate limiting between batches
        if (i + BATCH_SIZE < texts.length) {
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
        }
    }
    
    return embeddings
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error('Vectors must have the same length')
    }
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Infer knowledge category from text using embedding similarity
 */
export async function inferKnowledgeCategory(
    text: string,
    categoryEmbeddings: Map<KnowledgeCategory, number[]>
): Promise<{ category: KnowledgeCategory; confidence: number }> {
    const textEmbedding = await generateEmbedding(text)
    
    let bestCategory: KnowledgeCategory = 'GENERAL_KNOWLEDGE'
    let bestSimilarity = -1
    
    for (const [category, embedding] of categoryEmbeddings) {
        const similarity = cosineSimilarity(textEmbedding, embedding)
        if (similarity > bestSimilarity) {
            bestSimilarity = similarity
            bestCategory = category
        }
    }
    
    return {
        category: bestCategory,
        confidence: bestSimilarity
    }
}

/**
 * Infer knowledge category for a Jeopardy question
 * Combines category name, question text, and answer for better inference
 */
export async function inferQuestionKnowledgeCategory(
    categoryName: string,
    question: string,
    answer: string,
    categoryEmbeddings: Map<KnowledgeCategory, number[]>
): Promise<{ category: KnowledgeCategory; confidence: number }> {
    // Weight category name more heavily by repeating it
    const combinedText = `Category: ${categoryName}. ${categoryName}. Question: ${question}. Answer: ${answer}`
    return inferKnowledgeCategory(combinedText, categoryEmbeddings)
}

/**
 * Batch infer knowledge categories for multiple questions
 * More efficient than individual calls
 */
export async function batchInferKnowledgeCategories(
    questions: Array<{ categoryName: string; question: string; answer: string }>,
    categoryEmbeddings: Map<KnowledgeCategory, number[]>
): Promise<Array<{ category: KnowledgeCategory; confidence: number }>> {
    // Create combined texts
    const texts = questions.map(q => 
        `Category: ${q.categoryName}. ${q.categoryName}. Question: ${q.question}. Answer: ${q.answer}`
    )
    
    // Generate embeddings in batch
    const embeddings = await generateEmbeddings(texts)
    
    // Find best category for each
    return embeddings.map(embedding => {
        let bestCategory: KnowledgeCategory = 'GENERAL_KNOWLEDGE'
        let bestSimilarity = -1
        
        for (const [category, catEmbedding] of categoryEmbeddings) {
            const similarity = cosineSimilarity(embedding, catEmbedding)
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity
                bestCategory = category
            }
        }
        
        return {
            category: bestCategory,
            confidence: bestSimilarity
        }
    })
}

/**
 * Convert embedding array to pgvector SQL format
 */
export function toSql(embedding: number[]): string {
    return pgvector.toSql(embedding)
}

/**
 * Parse pgvector SQL format to array
 */
export function fromSql(sql: string): number[] {
    return pgvector.fromSql(sql)
}

/**
 * Check if OpenAI API is configured
 */
export function isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY
}


import { PrismaClient, KnowledgeCategory } from '@prisma/client'
import { readFileSync } from 'fs'
import path from 'path'
import crypto from 'crypto'

const prisma = new PrismaClient()

interface JeopardyQuestion {
    id: string;
    question: string;
    answer: string;
    value: number;
    category: string;
    knowledgeCategory: KnowledgeCategory;
    airDate?: string;
    season?: number;
    episodeId?: string;
}

function determineDifficulty(value: number): 'EASY' | 'MEDIUM' | 'HARD' {
    if (value <= 200) return 'EASY'
    if (value <= 600) return 'MEDIUM'
    return 'HARD'
}

async function main() {
    try {
        // Clear existing data
        console.log('Clearing existing data...')
        await prisma.gameQuestion.deleteMany({})
        await prisma.game.deleteMany({})
        await prisma.userProgress.deleteMany({})
        await prisma.gameHistory.deleteMany({})
        await prisma.question.deleteMany({})
        await prisma.category.deleteMany({})
        await prisma.tag.deleteMany({})

        // Read the scraped data
        const dataPath = path.join(__dirname, '../../data/jeopardy_questions.json')
        const rawData = readFileSync(dataPath, 'utf-8')
        const questions: JeopardyQuestion[] = JSON.parse(rawData)

        console.log(`Initializing database with ${questions.length} questions...`)

        // Group questions by category
        const categoriesMap = new Map<string, JeopardyQuestion[]>()
        questions.forEach(q => {
            const existing = categoriesMap.get(q.category) || []
            existing.push(q)
            categoriesMap.set(q.category, existing)
        })

        // Process each category
        for (const [categoryName, categoryQuestions] of categoriesMap) {
            console.log(`Processing category: ${categoryName}`)

            // Create or update category
            const category = await prisma.category.upsert({
                where: {
                    name: categoryName
                },
                update: {},
                create: {
                    id: crypto.randomUUID(),
                    name: categoryName
                }
            })

            // Add questions for this category
            for (const q of categoryQuestions) {
                await prisma.question.create({
                    data: {
                        id: q.id,
                        question: q.question,
                        answer: q.answer,
                        value: q.value,
                        categoryId: category.id,
                        knowledgeCategory: q.knowledgeCategory || KnowledgeCategory.GENERAL_KNOWLEDGE,
                        difficulty: determineDifficulty(q.value),
                        airDate: q.airDate ? new Date(q.airDate) : null,
                        season: q.season || null,
                        episodeId: q.episodeId || null
                    }
                })
            }
        }

        console.log('Database initialization complete!')
    } catch (error) {
        console.error('Error initializing database:', error)
        process.exit(1)
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect()
    }) 
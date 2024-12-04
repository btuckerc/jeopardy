// scripts/migrate-prod.ts
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { KnowledgeCategory, Difficulty } from '@prisma/client'

const prisma = new PrismaClient()

interface JeopardyQuestion {
    id: string
    question: string
    answer: string
    value: number
    airDate: string | null
    categoryId: string
    category: {
        id: string
        name: string
    }
    difficulty: Difficulty
    knowledgeCategory: KnowledgeCategory
    season?: number
    episodeId?: string
    wasTripleStumper: boolean
    isDoubleJeopardy: boolean
}

async function main() {
    // Check if database is empty
    const questionCount = await prisma.question.count()
    if (questionCount > 0) {
        console.log('Database already populated')
        return
    }

    // Read questions from JSON file
    const questionsPath = path.join(process.cwd(), 'data', 'jeopardy_questions.json')
    const questionsData = fs.readFileSync(questionsPath, 'utf-8')
    const questions: JeopardyQuestion[] = JSON.parse(questionsData)

    console.log(`Found ${questions.length} questions to migrate`)

    // First create all unique categories
    const uniqueCategories = new Map(questions.map(q => [q.category.id, q.category]))
    console.log(`Creating ${uniqueCategories.size} categories...`)

    for (const category of uniqueCategories.values()) {
        await prisma.category.upsert({
            where: { id: category.id },
            update: { name: category.name },
            create: {
                id: category.id,
                name: category.name
            }
        })
    }

    // Then create all questions
    console.log('Creating questions...')
    let created = 0
    for (const question of questions) {
        await prisma.question.create({
            data: {
                id: question.id,
                question: question.question,
                answer: question.answer,
                value: question.value,
                airDate: question.airDate ? new Date(question.airDate) : null,
                categoryId: question.categoryId,
                difficulty: question.difficulty,
                knowledgeCategory: question.knowledgeCategory,
                season: question.season,
                episodeId: question.episodeId,
                wasTripleStumper: question.wasTripleStumper,
                isDoubleJeopardy: question.isDoubleJeopardy
            }
        })
        created++
        if (created % 100 === 0) {
            console.log(`Created ${created} questions...`)
        }
    }

    console.log(`Migration complete! Created ${created} questions`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error:', error)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
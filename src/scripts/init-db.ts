'use server'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const sampleCategories = [
    {
        name: "SCIENCE & NATURE",
        questions: [
            {
                question: "This element's atomic number 79 & symbol Au comes from the Latin word for 'shining dawn'",
                answer: "Gold",
                value: 400,
                difficulty: "MEDIUM"
            },
            {
                question: "The speed of light is approximately 186,282 of these units per second",
                answer: "Miles",
                value: 600,
                difficulty: "MEDIUM"
            }
        ]
    },
    {
        name: "BUSINESS & FINANCE",
        questions: [
            {
                question: "This fruit-named tech company became the first U.S. company to reach a $1 trillion market cap",
                answer: "Apple",
                value: 800,
                difficulty: "HARD"
            },
            {
                question: "TSLA is the stock symbol for this electric car company",
                answer: "Tesla",
                value: 400,
                difficulty: "EASY"
            }
        ]
    },
    {
        name: "GEOGRAPHY",
        questions: [
            {
                question: "The United Kingdom consists of Great Britain & this island to its west",
                answer: "Ireland",
                value: 200,
                difficulty: "EASY"
            },
            {
                question: "This city, nicknamed the 'Pearl of the Orient,' is China's largest",
                answer: "Shanghai",
                value: 600,
                difficulty: "MEDIUM"
            }
        ]
    }
]

async function main() {
    try {
        console.log('Starting database initialization...')

        // Clear existing data
        await prisma.gameHistory.deleteMany()
        await prisma.userProgress.deleteMany()
        await prisma.question.deleteMany()
        await prisma.category.deleteMany()
        console.log('Cleared existing data')

        // Create categories and questions
        for (const cat of sampleCategories) {
            const category = await prisma.category.create({
                data: {
                    name: cat.name,
                    questions: {
                        create: cat.questions.map(q => ({
                            question: q.question,
                            answer: q.answer,
                            value: q.value,
                            difficulty: q.difficulty as 'EASY' | 'MEDIUM' | 'HARD',
                            source: 'sample_data'
                        }))
                    }
                }
            })
            console.log(`Created category: ${category.name}`)
        }

        console.log('Database initialization completed successfully')
    } catch (error) {
        console.error('Error initializing database:', error)
    } finally {
        await prisma.$disconnect()
    }
}

if (require.main === module) {
    main()
} 
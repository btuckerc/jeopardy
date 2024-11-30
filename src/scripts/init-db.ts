'use server'

import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'

interface Question {
    question: string;
    answer: string;
    value: number;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    airDate: string;
    source: string;
}

interface Category {
    name: string;
    questions: Question[];
}

const prisma = new PrismaClient()

// Sample data as fallback
const sampleCategories: Category[] = [
    {
        name: "SCIENCE & NATURE",
        questions: [
            {
                question: "This element's atomic number 79 & symbol Au comes from the Latin word for 'shining dawn'",
                answer: "Gold",
                value: 400,
                difficulty: "MEDIUM",
                airDate: new Date().toISOString(),
                source: "sample_data"
            },
            {
                question: "The speed of light is approximately 186,282 of these units per second",
                answer: "Miles",
                value: 600,
                difficulty: "MEDIUM",
                airDate: new Date().toISOString(),
                source: "sample_data"
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
                difficulty: "HARD",
                airDate: new Date().toISOString(),
                source: "sample_data"
            },
            {
                question: "TSLA is the stock symbol for this electric car company",
                answer: "Tesla",
                value: 400,
                difficulty: "EASY",
                airDate: new Date().toISOString(),
                source: "sample_data"
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
                difficulty: "EASY",
                airDate: new Date().toISOString(),
                source: "sample_data"
            },
            {
                question: "This city, nicknamed the 'Pearl of the Orient,' is China's largest",
                answer: "Shanghai",
                value: 600,
                difficulty: "MEDIUM",
                airDate: new Date().toISOString(),
                source: "sample_data"
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

        // Load Jeopardy data
        const dataPath = path.join(__dirname, '../../data/jeopardy-data.json')
        let categories: Category[] = []

        if (fs.existsSync(dataPath)) {
            console.log('Loading Jeopardy data...')
            const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
            categories = data
        } else {
            console.log('No Jeopardy data found, using sample data')
            categories = sampleCategories
        }

        // Create categories and questions
        for (const cat of categories) {
            const category = await prisma.category.create({
                data: {
                    name: cat.name,
                    questions: {
                        create: cat.questions.map(q => ({
                            question: q.question,
                            answer: q.answer,
                            value: q.value,
                            difficulty: q.difficulty,
                            source: q.source,
                            airDate: q.airDate ? new Date(q.airDate) : null
                        }))
                    }
                }
            })
            console.log(`Created category: ${category.name} with ${cat.questions.length} questions`)
        }

        console.log('Database initialization completed successfully')
    } catch (error) {
        console.error('Error initializing database:', error instanceof Error ? error.message : 'Unknown error')
    } finally {
        await prisma.$disconnect()
    }
}

if (require.main === module) {
    main()
} 
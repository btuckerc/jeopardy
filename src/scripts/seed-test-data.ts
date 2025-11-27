import { PrismaClient, Difficulty } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Seeding test data...')
    
    // Create test categories
    const categories = [
        { name: 'HISTORY', kc: 'GEOGRAPHY_AND_HISTORY' as const },
        { name: 'SCIENCE', kc: 'SCIENCE_AND_NATURE' as const },
        { name: 'GEOGRAPHY', kc: 'GEOGRAPHY_AND_HISTORY' as const },
        { name: 'LITERATURE', kc: 'ARTS_AND_LITERATURE' as const },
        { name: 'SPORTS', kc: 'SPORTS_AND_LEISURE' as const },
        { name: 'ENTERTAINMENT', kc: 'ENTERTAINMENT' as const }
    ]
    
    for (const { name: catName, kc } of categories) {
        const cat = await prisma.category.create({
            data: {
                name: catName,
                knowledgeCategory: kc
            }
        })
        
        // Create 5 questions per category
        for (let i = 1; i <= 5; i++) {
            const difficulty: Difficulty = i <= 2 ? 'EASY' : i <= 4 ? 'MEDIUM' : 'HARD'
            await prisma.question.create({
                data: {
                    question: `This is test question ${i} for the ${catName} category`,
                    answer: `Test answer ${i}`,
                    value: i * 200,
                    difficulty,
                    categoryId: cat.id,
                    knowledgeCategory: kc,
                    airDate: new Date('2024-01-01')
                }
            })
        }
        console.log(`Created category: ${catName} with 5 questions`)
    }
    
    console.log('\nTest data seeded successfully!')
    
    // Verify counts
    const catCount = await prisma.category.count()
    const qCount = await prisma.question.count()
    console.log(`Total Categories: ${catCount}, Total Questions: ${qCount}`)
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })


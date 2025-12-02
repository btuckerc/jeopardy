import { prisma } from '../lib/prisma'

const achievements = [
    {
        code: 'FIRST_GAME',
        name: 'First Steps',
        description: 'Complete your first game',
        icon: '🎮'
    },
    {
        code: 'PERFECT_ROUND',
        name: 'Perfect Round',
        description: 'Answer every question correctly in a round',
        icon: '⭐'
    },
    {
        code: 'TRIPLE_STUMPER_MASTER',
        name: 'Triple Stumper Master',
        description: 'Answer 10 triple stumper questions correctly',
        icon: '🧠'
    },
    {
        code: 'STREAK_MASTER_7',
        name: 'Week Warrior',
        description: 'Maintain a 7-day streak',
        icon: '🔥'
    },
    {
        code: 'STREAK_MASTER_30',
        name: 'Monthly Master',
        description: 'Maintain a 30-day streak',
        icon: '💪'
    },
    {
        code: 'SCORE_MASTER_10000',
        name: 'High Roller',
        description: 'Score $10,000 or more in a single game',
        icon: '💰'
    },
    {
        code: 'SCORE_MASTER_20000',
        name: 'Jeopardy Champion',
        description: 'Score $20,000 or more in a single game',
        icon: '🏆'
    },
    {
        code: 'DAILY_CHALLENGE_STREAK_7',
        name: 'Daily Dedication',
        description: 'Complete 7 daily challenges in a row',
        icon: '📅'
    },
    {
        code: 'QUESTIONS_MASTER_100',
        name: 'Century Club',
        description: 'Answer 100 questions',
        icon: '💯'
    },
    {
        code: 'QUESTIONS_MASTER_1000',
        name: 'Millennium Master',
        description: 'Answer 1,000 questions',
        icon: '🌟'
    }
]

async function main() {
    console.log('Seeding achievements...')

    for (const achievement of achievements) {
        await prisma.achievement.upsert({
            where: { code: achievement.code },
            update: achievement,
            create: achievement
        })
        console.log(`✓ ${achievement.name}`)
    }

    console.log('Achievements seeded successfully!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })


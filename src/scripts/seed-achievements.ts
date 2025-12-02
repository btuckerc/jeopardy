import { prisma } from '../lib/prisma'
import { ACHIEVEMENT_DEFINITIONS } from '../lib/achievement-definitions'

async function main() {
    console.log('Seeding achievements...')
    console.log(`Total achievements: ${ACHIEVEMENT_DEFINITIONS.length}`)

    let seeded = 0
    let updated = 0

    for (const achievement of ACHIEVEMENT_DEFINITIONS) {
        const existing = await prisma.achievement.findUnique({
            where: { code: achievement.code }
        })

        const data = {
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
            category: achievement.category,
            tier: achievement.tier ?? null,
            isHidden: achievement.isHidden ?? false
        }

        if (existing) {
            await prisma.achievement.update({
                where: { code: achievement.code },
                data
            })
            updated++
            console.log(`↻ Updated: ${achievement.name}`)
        } else {
            await prisma.achievement.create({
                data: {
                    code: achievement.code,
                    ...data
                }
            })
            seeded++
            console.log(`✓ Created: ${achievement.name}`)
        }
    }

    console.log(`\nSeeding complete!`)
    console.log(`  Created: ${seeded}`)
    console.log(`  Updated: ${updated}`)
    console.log(`  Total: ${ACHIEVEMENT_DEFINITIONS.length}`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })


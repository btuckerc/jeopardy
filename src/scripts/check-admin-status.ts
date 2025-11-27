/**
 * Script to check and update user admin status
 * Usage: npx tsx src/scripts/check-admin-status.ts [email]
 */

import { prisma } from '../lib/prisma'

async function main() {
    const emailArg = process.argv[2]
    
    if (!emailArg) {
        console.error('Usage: npx tsx src/scripts/check-admin-status.ts <email>')
        console.error('Example: npx tsx src/scripts/check-admin-status.ts btuckercraig@example.com')
        process.exit(1)
    }

    // Search for user by email (partial match)
    const users = await prisma.user.findMany({
        where: {
            email: {
                contains: emailArg,
                mode: 'insensitive'
            }
        },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            updatedAt: true
        }
    })

    if (users.length === 0) {
        console.log(`❌ No user found with email containing "${emailArg}"`)
        process.exit(1)
    }

    console.log(`\n📋 Found ${users.length} user(s):\n`)
    
    for (const user of users) {
        console.log(`User ID: ${user.id}`)
        console.log(`Email: ${user.email}`)
        console.log(`Name: ${user.name || 'N/A'}`)
        console.log(`Current Role: ${user.role}`)
        console.log(`Created: ${user.createdAt}`)
        console.log(`Updated: ${user.updatedAt}`)
        console.log(`---`)
    }

    // Check if any user needs admin status
    const nonAdminUsers = users.filter(u => u.role !== 'ADMIN')
    
    if (nonAdminUsers.length === 0) {
        console.log(`\n✅ All matching users already have ADMIN role`)
        return
    }

    console.log(`\n⚠️  Found ${nonAdminUsers.length} user(s) without ADMIN role:`)
    nonAdminUsers.forEach(u => {
        console.log(`  - ${u.email} (${u.role})`)
    })

    // If only one user, offer to update
    if (users.length === 1) {
        const user = users[0]
        if (user.role !== 'ADMIN') {
            console.log(`\n🔄 Updating ${user.email} to ADMIN role...`)
            
            await prisma.user.update({
                where: { id: user.id },
                data: { role: 'ADMIN' }
            })
            
            console.log(`✅ Successfully updated ${user.email} to ADMIN role`)
            console.log(`\n💡 Note: You may need to sign out and sign back in for the changes to take effect.`)
        }
    } else {
        console.log(`\n⚠️  Multiple users found. Please specify the exact email address.`)
        console.log(`   Or update manually using:`)
        console.log(`   await prisma.user.update({ where: { id: 'USER_ID' }, data: { role: 'ADMIN' } })`)
    }
}

main()
    .catch((e) => {
        console.error('Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })


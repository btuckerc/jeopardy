import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
    const connectionString = process.env.DATABASE_URL || ''
    const url = new URL(connectionString)
    url.searchParams.set('pgbouncer', 'true')
    url.searchParams.set('prepare', 'false')

    return new PrismaClient({
        datasources: {
            db: {
                url: url.toString()
            }
        },
        log: ['error', 'warn']
    })
}

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientSingleton | undefined
}

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma 
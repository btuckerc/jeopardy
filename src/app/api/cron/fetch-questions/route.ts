import { NextResponse } from 'next/server'
import { spawn, type ChildProcess } from 'child_process'
import path from 'path'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

// Get Node.js process global
declare const process: {
    env: {
        [key: string]: string | undefined
        NODE_ENV: 'development' | 'production'
        CRON_SECRET?: string
    }
    cwd(): string
}

export async function GET(request: Request) {
    try {
        // Verify cron secret to prevent unauthorized access
        const authHeader = request.headers.get('authorization')
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        // Execute the fetch script
        const scriptPath = path.join(process.cwd(), 'src', 'scripts', 'fetch-yesterday-questions.ts')
        const childProcess: ChildProcess = spawn('npx', ['ts-node', scriptPath], {
            env: {
                ...process.env,
                NODE_ENV: 'production'
            }
        })

        let output = ''
        let error = ''

        childProcess.stdout?.on('data', (data: Buffer) => {
            output += data.toString()
        })

        childProcess.stderr?.on('data', (data: Buffer) => {
            error += data.toString()
        })

        await new Promise<string>((resolve, reject) => {
            childProcess.on('close', (code: number) => {
                if (code === 0) {
                    resolve(output)
                } else {
                    reject(new Error(`Process exited with code ${code}\n${error}`))
                }
            })
        })

        return NextResponse.json({
            success: true,
            message: 'Questions fetched and updated successfully',
            output
        })
    } catch (error) {
        console.error('Error in cron job:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
} 
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { useState } from 'react'
import { Session } from 'next-auth'

interface ProvidersProps {
    children: React.ReactNode
    session: Session | null
}

export function Providers({ children, session }: ProvidersProps) {
    const [queryClient] = useState(() => new QueryClient())

    return (
        // Pass the server-fetched session to SessionProvider
        // This hydrates the client with the correct initial state - no flash
        <SessionProvider session={session}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </SessionProvider>
    )
}

import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'trivrdy - Study Jeopardy Online'
export const size = {
    width: 1200,
    height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    background: 'linear-gradient(to bottom right, #1E40AF, #1D4ED8)',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                    }}
                >
                    <h1
                        style={{
                            fontSize: '80px',
                            fontWeight: 'bold',
                            color: 'white',
                            marginBottom: '20px',
                            textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                        }}
                    >
                        trivrdy
                    </h1>
                    <p
                        style={{
                            fontSize: '40px',
                            color: 'white',
                            opacity: 0.9,
                            marginBottom: '40px',
                            maxWidth: '800px',
                            textAlign: 'center',
                        }}
                    >
                        Study Jeopardy Online | Practice Trivia Game
                    </p>
                    <div
                        style={{
                            display: 'flex',
                            gap: '20px',
                            marginTop: '20px',
                        }}
                    >
                        <div
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                padding: '16px 32px',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '32px',
                            }}
                        >
                            Game Mode
                        </div>
                        <div
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                padding: '16px 32px',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '32px',
                            }}
                        >
                            Study Mode
                        </div>
                    </div>
                    <p
                        style={{
                            fontSize: '24px',
                            color: 'white',
                            opacity: 0.8,
                            marginTop: '40px',
                        }}
                    >
                        Created by Tucker Craig
                    </p>
                </div>
            </div>
        ),
        {
            ...size,
        }
    )
} 
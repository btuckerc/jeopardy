export type GameQuestion = {
    id: string
    question: string
    answer: string
    value: number
    category: string
    difficulty: 'EASY' | 'MEDIUM' | 'HARD'
}

export type GameCategory = {
    id: string
    name: string
    questions: GameQuestion[]
}

export type GameBoard = {
    categories: GameCategory[]
    currentRound: number
    score: number
    answeredQuestions: Set<string>
}

export type GameState = {
    board: GameBoard
    selectedQuestion: GameQuestion | null
    isAnswering: boolean
    showAnswer: boolean
    userAnswer: string
} 
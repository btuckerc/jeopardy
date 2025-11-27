// Re-export from the main implementation to ensure a single source of truth
// All answer-checking logic lives in src/app/lib/answer-checker.ts
export { checkAnswer, calculatePoints } from '../app/lib/answer-checker'

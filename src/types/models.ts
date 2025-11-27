import { z } from 'zod';

// Enums
export enum Difficulty {
    EASY = 'EASY',
    MEDIUM = 'MEDIUM',
    HARD = 'HARD',
}

export enum UserRole {
    USER = 'USER',
    ADMIN = 'ADMIN',
}

export enum KnowledgeCategory {
    GEOGRAPHY_AND_HISTORY = 'GEOGRAPHY_AND_HISTORY',
    ENTERTAINMENT = 'ENTERTAINMENT',
    ARTS_AND_LITERATURE = 'ARTS_AND_LITERATURE',
    SCIENCE_AND_NATURE = 'SCIENCE_AND_NATURE',
    SPORTS_AND_LEISURE = 'SPORTS_AND_LEISURE',
    GENERAL_KNOWLEDGE = 'GENERAL_KNOWLEDGE',
}

// Zod Schemas
export const userSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email().nullable(),
    displayName: z.string().nullable(),
    selectedIcon: z.string().nullable(),
    avatarBackground: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    role: z.nativeEnum(UserRole),
    lastSpoilerPrompt: z.date().nullable(),
    spoilerBlockDate: z.date().nullable(),
    spoilerBlockEnabled: z.boolean(),
});

export const questionSchema = z.object({
    id: z.string().uuid(),
    question: z.string(),
    answer: z.string(),
    value: z.number(),
    difficulty: z.nativeEnum(Difficulty),
    categoryId: z.string().uuid(),
    knowledgeCategory: z.nativeEnum(KnowledgeCategory),
    airDate: z.date().nullable(),
    season: z.number().nullable(),
    episodeId: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    wasTripleStumper: z.boolean(),
    isDoubleJeopardy: z.boolean(),
});

export const categorySchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export const gameHistorySchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    questionId: z.string().uuid(),
    correct: z.boolean(),
    points: z.number(),
    timestamp: z.date(),
});

export const userProgressSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    categoryId: z.string().uuid(),
    questionId: z.string().uuid(),
    correct: z.number(),
    total: z.number(),
    points: z.number(),
});

export const gameSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    useKnowledgeCategories: z.boolean(),
    score: z.number(),
    completed: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export const gameQuestionSchema = z.object({
    id: z.string().uuid(),
    gameId: z.string().uuid(),
    questionId: z.string().uuid(),
    answered: z.boolean(),
    correct: z.boolean().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

// TypeScript Types
export type User = z.infer<typeof userSchema>;
export type Question = z.infer<typeof questionSchema>;
export type Category = z.infer<typeof categorySchema>;
export type GameHistory = z.infer<typeof gameHistorySchema>;
export type UserProgress = z.infer<typeof userProgressSchema>;
export type Game = z.infer<typeof gameSchema>;
export type GameQuestion = z.infer<typeof gameQuestionSchema>; 
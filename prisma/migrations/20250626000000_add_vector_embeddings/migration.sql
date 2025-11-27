-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to Question table
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Add knowledgeCategory and embedding columns to Category table
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "knowledgeCategory" "KnowledgeCategory";
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Create KnowledgeCategoryEmbedding table for reference embeddings
CREATE TABLE IF NOT EXISTS "KnowledgeCategoryEmbedding" (
    "id" TEXT NOT NULL,
    "knowledgeCategory" "KnowledgeCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeCategoryEmbedding_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on knowledgeCategory
CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeCategoryEmbedding_knowledgeCategory_key" 
ON "KnowledgeCategoryEmbedding"("knowledgeCategory");

-- Create HNSW indexes for fast similarity search
CREATE INDEX IF NOT EXISTS "question_embedding_idx" 
ON "Question" USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "category_embedding_idx" 
ON "Category" USING hnsw ("embedding" vector_cosine_ops);


-- Create HNSW indexes for fast vector similarity search
-- These indexes dramatically improve performance for nearest-neighbor queries
-- Note: These require pgvector extension with HNSW support (pgvector >= 0.5.0)

-- Only create indexes if the vector extension is available
DO $$
BEGIN
    -- Check if vector extension exists
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        -- HNSW index on Question embeddings for semantic search
        -- Using cosine distance operator (<=>)
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'question_embedding_hnsw_idx') THEN
            EXECUTE 'CREATE INDEX "question_embedding_hnsw_idx" ON "Question" USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)';
        END IF;

        -- HNSW index on Category embeddings for category similarity
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'category_embedding_hnsw_idx') THEN
            EXECUTE 'CREATE INDEX "category_embedding_hnsw_idx" ON "Category" USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)';
        END IF;

        -- HNSW index on KnowledgeCategoryEmbedding for fast knowledge category inference
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'knowledge_category_embedding_hnsw_idx') THEN
            EXECUTE 'CREATE INDEX "knowledge_category_embedding_hnsw_idx" ON "KnowledgeCategoryEmbedding" USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)';
        END IF;
    END IF;
END $$;

-- Add a comment explaining the index parameters:
-- m = 16: Number of bi-directional links per node (default is 16, good balance of speed/recall)
-- ef_construction = 64: Size of dynamic candidate list for construction (higher = better recall, slower build)

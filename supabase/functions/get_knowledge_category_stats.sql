-- Drop the function if it exists
DROP FUNCTION IF EXISTS public.get_knowledge_category_stats(user_id uuid);

-- Create the function with proper parameter handling
CREATE OR REPLACE FUNCTION public.get_knowledge_category_stats(user_id uuid DEFAULT NULL)
RETURNS TABLE (
    knowledge_category text,
    total_questions bigint,
    correct_questions bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q."knowledgeCategory"::text,
        COUNT(DISTINCT q.id) as total_questions,
        COUNT(DISTINCT CASE 
            WHEN gh.correct = true AND (gh."userId" = user_id OR user_id IS NULL)
            THEN q.id 
        END) as correct_questions
    FROM "Question" q
    LEFT JOIN "GameHistory" gh ON gh."questionId" = q.id 
        AND (gh."userId" = user_id OR user_id IS NULL)
    GROUP BY q."knowledgeCategory"
    ORDER BY q."knowledgeCategory";
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_knowledge_category_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_knowledge_category_stats() TO authenticated; 
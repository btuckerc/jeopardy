-- Enable RLS
ALTER TABLE "GameHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserProgress" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own game history" ON "GameHistory";
DROP POLICY IF EXISTS "Users can insert their own game history" ON "GameHistory";
DROP POLICY IF EXISTS "Service role can manage game history" ON "GameHistory";
DROP POLICY IF EXISTS "Users can view their own progress" ON "UserProgress";
DROP POLICY IF EXISTS "Users can update their own progress" ON "UserProgress";
DROP POLICY IF EXISTS "Users can insert their own progress" ON "UserProgress";
DROP POLICY IF EXISTS "Service role can manage user progress" ON "UserProgress";

-- Create policies for GameHistory
CREATE POLICY "Users can view their own game history"
    ON "GameHistory"
    FOR SELECT
    USING ("userId"::uuid = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can insert their own game history"
    ON "GameHistory"
    FOR INSERT
    WITH CHECK ("userId"::uuid = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Service role can manage game history"
    ON "GameHistory"
    FOR ALL
    USING (auth.role() = 'service_role');

-- Create policies for UserProgress
CREATE POLICY "Users can view their own progress"
    ON "UserProgress"
    FOR SELECT
    USING ("userId"::uuid = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can insert their own progress"
    ON "UserProgress"
    FOR INSERT
    WITH CHECK ("userId"::uuid = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can update their own progress"
    ON "UserProgress"
    FOR UPDATE
    USING ("userId"::uuid = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Service role can manage user progress"
    ON "UserProgress"
    FOR ALL
    USING (auth.role() = 'service_role');

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT ON "GameHistory" TO authenticated;
GRANT SELECT, INSERT, UPDATE ON "UserProgress" TO authenticated;
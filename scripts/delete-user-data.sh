#!/bin/bash
# Delete all user data by email
# Usage: ./delete-user-data.sh "user@example.com"

EMAIL="$1"

if [ -z "$EMAIL" ]; then
	echo "Usage: ./delete-user-data.sh \"user@example.com\""
	exit 1
fi

echo "Deleting all data for user: $EMAIL"
echo "This will permanently delete:"
echo "  - User account"
echo "  - All games and game questions"
echo "  - User progress and stats"
echo "  - Daily challenge answers"
echo "  - Achievement progress"
echo "  - Disputes"
echo ""
read -p "Are you sure? Type 'yes' to continue: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
	echo "Cancelled."
	exit 0
fi

# SQL to delete user by email
SQL="
-- First, get the user ID
DO \$\$
DECLARE
    user_id UUID;
BEGIN
    -- Find user by email
    SELECT id INTO user_id FROM \"User\" WHERE email = '$EMAIL';
    
    IF user_id IS NULL THEN
        RAISE NOTICE 'User with email $EMAIL not found';
    ELSE
        RAISE NOTICE 'Deleting user %', user_id;
        
        -- Delete in order to respect foreign keys
        DELETE FROM \"GameQuestion\" WHERE \"gameId\" IN (SELECT id FROM \"Game\" WHERE \"userId\" = user_id);
        DELETE FROM \"Game\" WHERE \"userId\" = user_id;
        DELETE FROM \"UserDailyChallenge\" WHERE \"userId\" = user_id;
        DELETE FROM \"UserAchievement\" WHERE \"userId\" = user_id;
        DELETE FROM \"AchievementProgress\" WHERE \"userId\" = user_id;
        DELETE FROM \"UserProgress\" WHERE \"userId\" = user_id;
        DELETE FROM \"GameHistory\" WHERE \"userId\" = user_id;
        DELETE FROM \"AnswerDispute\" WHERE \"userId\" = user_id;
        DELETE FROM \"User\" WHERE id = user_id;
        
        RAISE NOTICE 'User % deleted successfully', user_id;
    END IF;
END \$\$;
"

# Execute the SQL
docker compose exec -T db psql -U jeopardy -d jeopardy -c "$SQL"

echo ""
echo "Done! User data for $EMAIL has been deleted."
echo "Note: Clerk user data must be deleted separately from the Clerk dashboard."

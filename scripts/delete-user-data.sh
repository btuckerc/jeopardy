#!/bin/bash
# Delete all user data by email
# Usage: ./delete-user-data.sh "user@example.com"

# Load environment variables from .env file if it exists
if [ -f .env ]; then
	export $(grep -v '^#' .env | xargs)
fi

# Use environment variables or defaults
DB_USER="${POSTGRES_USER:-trivrdy}"
DB_NAME="${POSTGRES_DB:-trivrdy}"
DB_PASSWORD="${POSTGRES_PASSWORD:-}"

EMAIL="$1"

if [ -z "$EMAIL" ]; then
	echo "Usage: ./delete-user-data.sh \"user@example.com\""
	exit 1
fi

echo "Deleting all data for user: $EMAIL"
echo "Database: $DB_NAME (user: $DB_USER)"
echo ""
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

# Execute the SQL using the correct credentials from .env
docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -c "$SQL"

if [ $? -eq 0 ]; then
	echo ""
	echo "Done! User data for $EMAIL has been deleted."
	echo "Note: Clerk user data must be deleted separately from the Clerk dashboard."
else
	echo ""
	echo "Error: Failed to delete user data. Check that the database is running and credentials are correct."
	echo "Current settings: DB_USER=$DB_USER, DB_NAME=$DB_NAME"
fi

#!/bin/bash
# Delete all user data by email
# Usage: ./delete-user-data.sh "user@example.com"

set -e

EMAIL="$1"

if [ -z "$EMAIL" ]; then
	echo "Usage: ./delete-user-data.sh \"user@example.com\""
	exit 1
fi

# Function to safely read value from .env file
read_env_var() {
	local var_name="$1"
	local env_file="${2:-.env}"

	if [ -f "$env_file" ]; then
		# Use grep to find the line, sed to extract just the value
		# Handles values with or without quotes
		grep "^${var_name}=" "$env_file" 2>/dev/null | sed -E 's/^[^=]+=//' | sed -E 's/^"(.*)"$/\1/' | sed "s/^'\(.*\)'$/\1/" | head -1
	fi
}

# Read database credentials from .env or use defaults
if [ -f .env ]; then
	DB_USER=$(read_env_var "POSTGRES_USER")
	DB_NAME=$(read_env_var "POSTGRES_DB")
	DB_PASSWORD=$(read_env_var "POSTGRES_PASSWORD")
fi

# Use defaults if not found
DB_USER="${DB_USER:-trivrdy}"
DB_NAME="${DB_NAME:-trivrdy}"

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
# Note: User.id is TEXT (CUID format like 'cml7cuqq40000nw6rusu29v2a'), not UUID
SQL=$(
	cat <<EOF
DO \$\$
DECLARE
    user_id TEXT;
BEGIN
    -- Find user by email
    SELECT id INTO user_id FROM "User" WHERE email = '$EMAIL';
    
    IF user_id IS NULL THEN
        RAISE NOTICE 'User with email $EMAIL not found';
    ELSE
        RAISE NOTICE 'Found user ID: %', user_id;
        
        -- Delete in order to respect foreign keys
        RAISE NOTICE 'Deleting GameQuestion records...';
        DELETE FROM "GameQuestion" WHERE "gameId" IN (SELECT id FROM "Game" WHERE "userId" = user_id);
        
        RAISE NOTICE 'Deleting Game records...';
        DELETE FROM "Game" WHERE "userId" = user_id;
        
        RAISE NOTICE 'Deleting UserDailyChallenge records...';
        DELETE FROM "UserDailyChallenge" WHERE "userId" = user_id;
        
        RAISE NOTICE 'Deleting UserAchievement records...';
        DELETE FROM "UserAchievement" WHERE "userId" = user_id;
        
        RAISE NOTICE 'Deleting AchievementProgress records...';
        DELETE FROM "AchievementProgress" WHERE "userId" = user_id;
        
        RAISE NOTICE 'Deleting UserProgress records...';
        DELETE FROM "UserProgress" WHERE "userId" = user_id;
        
        RAISE NOTICE 'Deleting GameHistory records...';
        DELETE FROM "GameHistory" WHERE "userId" = user_id;
        
        RAISE NOTICE 'Deleting AnswerDispute records...';
        DELETE FROM "AnswerDispute" WHERE "userId" = user_id;
        
        RAISE NOTICE 'Deleting User record...';
        DELETE FROM "User" WHERE id = user_id;
        
        RAISE NOTICE 'User % deleted successfully', user_id;
    END IF;
END \$\$;
EOF
)

# Execute the SQL
echo ""
echo "Executing deletion..."
if docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -c "$SQL" 2>&1; then
	echo ""
	echo "✓ Success! User data for $EMAIL has been deleted from the database."
	echo ""
	echo "Important next steps:"
	echo "1. Clear localStorage in your browser:"
	echo "   - Open DevTools (F12)"
	echo "   - Go to Application/Storage tab"
	echo "   - Clear Local Storage for localhost:1034"
	echo "   - OR run in console: localStorage.clear()"
	echo ""
	echo "2. Delete Clerk user data from the Clerk dashboard:"
	echo "   - Go to https://dashboard.clerk.com/"
	echo "   - Find and delete the user with email: $EMAIL"
	echo ""
	echo "3. Sign up again to test as a 'new' user"
else
	echo ""
	echo "✗ Error: Failed to delete user data."
	echo ""
	echo "Troubleshooting:"
	echo "1. Check that Docker is running: docker ps"
	echo "2. Verify database container is up: docker compose ps"
	echo "3. Check database logs: docker compose logs db"
	echo "4. Verify credentials in .env file"
	echo ""
	echo "Current settings: DB_USER=$DB_USER, DB_NAME=$DB_NAME"
	exit 1
fi

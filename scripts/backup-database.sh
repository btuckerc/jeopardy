#!/bin/bash
#
# Database Backup Script for Trivrdy
# Creates a timestamped pg_dump backup of the production database
#
# Usage:
#   ./scripts/backup-database.sh              # Creates backup with default retention
#   ./scripts/backup-database.sh --keep 10    # Keep only the 10 most recent backups
#
# The script:
#   - Creates a timestamped SQL backup in the backups/ directory
#   - Verifies backup integrity
#   - Optionally cleans up old backups (default: keep 8 weeks worth)
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
CONTAINER_NAME="jeopardy-db-1"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/trivrdy_backup_${TIMESTAMP}.sql"
LOG_FILE="$BACKUP_DIR/backup.log"
KEEP_BACKUPS=8 # Default: keep 8 weekly backups (2 months)

# Parse arguments
while [[ $# -gt 0 ]]; do
	case $1 in
	--keep)
		KEEP_BACKUPS="$2"
		shift 2
		;;
	*)
		echo "Unknown option: $1"
		exit 1
		;;
	esac
done

# Logging function
log() {
	echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

log "Starting database backup..."

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
	log "ERROR: Container $CONTAINER_NAME is not running"
	exit 1
fi

# Load database credentials from .env
if [[ -f "$PROJECT_DIR/.env" ]]; then
	source <(grep -E '^POSTGRES_(USER|PASSWORD|DB)=' "$PROJECT_DIR/.env" | sed 's/"//g')
fi

DB_USER="${POSTGRES_USER:-trivrdy}"
DB_NAME="${POSTGRES_DB:-trivrdy}"

# Create backup
log "Creating backup: $BACKUP_FILE"
if docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" \
	--clean --if-exists --no-owner --no-acl >"$BACKUP_FILE"; then

	# Verify backup
	if grep -q "PostgreSQL database dump complete" "$BACKUP_FILE"; then
		BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
		TABLE_COUNT=$(grep -c "^CREATE TABLE" "$BACKUP_FILE" || echo "0")
		log "SUCCESS: Backup created ($BACKUP_SIZE, $TABLE_COUNT tables)"
	else
		log "ERROR: Backup file appears incomplete"
		rm -f "$BACKUP_FILE"
		exit 1
	fi
else
	log "ERROR: pg_dump failed"
	rm -f "$BACKUP_FILE"
	exit 1
fi

# Cleanup old backups (keep the most recent N)
if [[ "$KEEP_BACKUPS" -gt 0 ]]; then
	BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/trivrdy_backup_*.sql 2>/dev/null | wc -l | tr -d ' ')
	if [[ "$BACKUP_COUNT" -gt "$KEEP_BACKUPS" ]]; then
		DELETE_COUNT=$((BACKUP_COUNT - KEEP_BACKUPS))
		log "Cleaning up old backups (keeping $KEEP_BACKUPS, deleting $DELETE_COUNT)"
		ls -1t "$BACKUP_DIR"/trivrdy_backup_*.sql | tail -n "$DELETE_COUNT" | xargs rm -f
	fi
fi

log "Backup complete"

#!/bin/bash
#
# Mac mini deployment workflow:
# - updates the repo to origin/main
# - creates a DB backup when possible
# - rebuilds the production-style web image
# - runs Prisma deploy/generate in the built image
# - starts the refreshed web container
#
# Usage:
#   ./scripts/deploy-macmini.sh
#   ./scripts/deploy-macmini.sh --logs
#   ./scripts/deploy-macmini.sh --skip-backup
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"
DB_SERVICE="db"
WEB_SERVICE="web"
FOLLOW_LOGS=false
SKIP_BACKUP=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --logs)
            FOLLOW_LOGS=true
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --help|-h)
            cat <<'EOF'
Usage: ./scripts/deploy-macmini.sh [options]

Options:
  --logs         Follow web logs after startup
  --skip-backup  Skip the database backup step
  --help         Show this help message
EOF
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

log() {
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

run() {
    log "$*"
    "$@"
}

cd "$PROJECT_DIR"

run git fetch origin
run git checkout main
run git pull --ff-only origin main

if [[ "$SKIP_BACKUP" == false ]]; then
    if docker compose -f "$COMPOSE_FILE" ps --status running "$DB_SERVICE" | grep -q "$DB_SERVICE"; then
        run "$PROJECT_DIR/scripts/backup-database.sh"
    else
        log "Skipping backup because $DB_SERVICE is not running. Start it first or rerun without --skip-backup once it is up."
    fi
fi

run docker compose -f "$COMPOSE_FILE" up -d "$DB_SERVICE"
run docker compose -f "$COMPOSE_FILE" build "$WEB_SERVICE"
run docker compose -f "$COMPOSE_FILE" run --rm --no-deps --entrypoint sh "$WEB_SERVICE" -lc 'npx prisma migrate deploy && npx prisma generate'
run docker compose -f "$COMPOSE_FILE" up -d --no-deps "$WEB_SERVICE"

log "Mac mini deploy complete."
log "Web status:"
docker compose -f "$COMPOSE_FILE" ps "$WEB_SERVICE"

if [[ "$FOLLOW_LOGS" == true ]]; then
    run docker compose -f "$COMPOSE_FILE" logs --tail 100 -f "$WEB_SERVICE"
else
    log "Recent web logs:"
    docker compose -f "$COMPOSE_FILE" logs --tail 100 "$WEB_SERVICE"
fi

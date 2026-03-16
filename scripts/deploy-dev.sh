#!/bin/bash

# deploy-dev.sh - Optimized development deployment script
# Handles DB startup, web container rebuild, and health checks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
DB_SERVICE="db"
WEB_SERVICE="web"
DB_PORT="${DEV_DB_PORT:-1033}"
WEB_PORT="${DEV_WEB_PORT:-1034}"

# Flags
FAST_MODE=false
FORCE_MODE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
	case $1 in
	--fast)
		FAST_MODE=true
		shift
		;;
	--force)
		FORCE_MODE=true
		shift
		;;
	--help | -h)
		echo "Usage: $0 [OPTIONS]"
		echo ""
		echo "Options:"
		echo "  --fast    Skip build if image exists (faster)"
		echo "  --force   Force recreate all containers"
		echo "  --help    Show this help message"
		echo ""
		echo "Environment Variables:"
		echo "  DEV_WEB_PORT    Port for web app (default: 1034)"
		echo "  DEV_DB_PORT     Port for database (default: 1033)"
		echo ""
		echo "Examples:"
		echo "  $0                    # Standard deploy"
		echo "  $0 --fast             # Skip build step"
		echo "  $0 --force            # Full rebuild"
		exit 0
		;;
	*)
		echo -e "${RED}Unknown option: $1${NC}"
		echo "Use --help for usage information"
		exit 1
		;;
	esac
done

# Helper functions
print_status() {
	echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"
}

print_success() {
	echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
	echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
	echo -e "${RED}✗${NC} $1"
}

# Check if Docker is running
check_docker() {
	print_status "Checking Docker daemon..."
	if ! docker info >/dev/null 2>&1; then
		print_error "Docker is not running"
		echo "Please start Docker Desktop or the Docker daemon"
		exit 1
	fi
	print_success "Docker is running"
}

# Check environment file
check_env() {
	print_status "Checking environment configuration..."

	if [ ! -f ".env.local" ] && [ ! -f ".env" ]; then
		print_warning "No .env.local or .env file found"
		echo "Make sure you have environment variables configured!"
	fi

	# Check if compose file exists
	if [ ! -f "$COMPOSE_FILE" ]; then
		print_error "Docker compose file not found: $COMPOSE_FILE"
		exit 1
	fi

	print_success "Environment check passed"
}

# Check if database is running
check_db() {
	if docker compose -f "$COMPOSE_FILE" ps | grep -q "${DB_SERVICE}.*running"; then
		return 0
	else
		return 1
	fi
}

# Start database if needed
start_db() {
	print_status "Checking database container..."

	if check_db; then
		print_success "Database is already running"
		return 0
	fi

	print_status "Starting database container..."
	docker compose -f "$COMPOSE_FILE" up -d "$DB_SERVICE"

	# Wait for DB to be ready
	print_status "Waiting for database to be ready..."
	local attempts=0
	local max_attempts=30

	while [ $attempts -lt $max_attempts ]; do
		if docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" pg_isready -U "${POSTGRES_USER:-postgres}" >/dev/null 2>&1; then
			print_success "Database is ready"
			return 0
		fi
		attempts=$((attempts + 1))
		echo -ne "  Attempt $attempts/$max_attempts...\r"
		sleep 1
	done

	print_error "Database failed to start within ${max_attempts} seconds"
	exit 1
}

# Stop web container gracefully
stop_web() {
	print_status "Stopping web container..."

	if docker compose -f "$COMPOSE_FILE" ps | grep -q "${WEB_SERVICE}.*running"; then
		# Try graceful stop first
		docker compose -f "$COMPOSE_FILE" stop -t 10 "$WEB_SERVICE" || true

		# Force kill if still running
		if docker compose -f "$COMPOSE_FILE" ps | grep -q "${WEB_SERVICE}.*running"; then
			print_warning "Container didn't stop gracefully, forcing..."
			docker compose -f "$COMPOSE_FILE" kill "$WEB_SERVICE" || true
		fi

		print_success "Web container stopped"
	else
		print_success "Web container not running"
	fi
}

# Remove web container
remove_web() {
	print_status "Removing old web container..."
	docker compose -f "$COMPOSE_FILE" rm -f "$WEB_SERVICE" 2>/dev/null || true
	print_success "Old container removed"
}

# Build and start web container
start_web() {
	print_status "Building and starting web container..."

	local build_flag=""
	if [ "$FAST_MODE" = true ]; then
		print_status "Fast mode: skipping build step"
		build_flag=""
	elif [ "$FORCE_MODE" = true ]; then
		print_status "Force mode: rebuilding all containers"
		build_flag="--build --force-recreate"
	else
		build_flag="--build"
	fi

	# Start the web service
	docker compose -f "$COMPOSE_FILE" up -d $build_flag "$WEB_SERVICE"

	print_success "Web container started"
}

# Wait for web container to be healthy
wait_for_web() {
	print_status "Waiting for web container to be ready..."

	local attempts=0
	local max_attempts=60

	while [ $attempts -lt $max_attempts ]; do
		# Check if container is running
		if ! docker compose -f "$COMPOSE_FILE" ps | grep -q "${WEB_SERVICE}.*running"; then
			print_error "Web container stopped unexpectedly"
			echo "Check logs with: docker compose logs $WEB_SERVICE"
			exit 1
		fi

		# Try to connect to the application
		if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$WEB_PORT" 2>/dev/null | grep -q "200\|307"; then
			print_success "Web application is ready"
			return 0
		fi

		attempts=$((attempts + 1))
		echo -ne "  Attempt $attempts/$max_attempts...\r"
		sleep 1
	done

	print_warning "Web container is running but health check timed out"
	print_warning "The app might still be initializing..."
}

# Show final status
show_status() {
	echo ""
	echo -e "${GREEN}═══════════════════════════════════════════${NC}"
	echo -e "${GREEN}  Deployment Complete!${NC}"
	echo -e "${GREEN}═══════════════════════════════════════════${NC}"
	echo ""

	# Show running containers
	echo "Running containers:"
	docker compose -f "$COMPOSE_FILE" ps

	echo ""
	echo "URLs:"
	echo -e "  ${BLUE}App:${NC}        http://localhost:$WEB_PORT"
	echo -e "  ${BLUE}Database:${NC}   localhost:$DB_PORT"
	echo ""
	echo "Commands:"
	echo -e "  ${YELLOW}View logs:${NC}  docker compose logs -f $WEB_SERVICE"
	echo -e "  ${YELLOW}Stop all:${NC}   docker compose down"
	echo -e "  ${YELLOW}Stop web:${NC}   docker compose stop $WEB_SERVICE"
	echo ""
}

# Cleanup on error
cleanup() {
	local exit_code=$?
	if [ $exit_code -ne 0 ]; then
		echo ""
		print_error "Deployment failed with exit code $exit_code"
		echo ""
		echo "Troubleshooting:"
		echo "  1. Check Docker is running: docker info"
		echo "  2. Check logs: docker compose logs"
		echo "  3. Verify environment variables in .env.local"
		echo "  4. Try force mode: $0 --force"
		echo ""
	fi
	exit $exit_code
}

trap cleanup EXIT

# Main execution
main() {
	echo -e "${GREEN}═══════════════════════════════════════════${NC}"
	echo -e "${GREEN}  Starting Development Deployment${NC}"
	echo -e "${GREEN}═══════════════════════════════════════════${NC}"
	echo ""

	check_docker
	check_env
	start_db
	stop_web
	remove_web
	start_web
	wait_for_web
	show_status
}

main "$@"

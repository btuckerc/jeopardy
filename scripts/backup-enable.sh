#!/bin/bash
#
# Enable automated database backups on macOS
# Sets up the launchd agent for weekly backups
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PLIST_NAME="com.trivrdy.backup"
PLIST_SOURCE="$SCRIPT_DIR/${PLIST_NAME}.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

echo "🔧 Enabling trivrdy automated backups..."

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ Error: This script is designed for macOS only"
    exit 1
fi

# Check if plist exists
if [[ ! -f "$PLIST_SOURCE" ]]; then
    echo "❌ Error: Launch agent plist not found at $PLIST_SOURCE"
    exit 1
fi

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$HOME/Library/LaunchAgents"

# Stop and unload if already loaded (to update)
if launchctl list | grep -q "^${PLIST_NAME}$"; then
    echo "🔄 Updating existing launch agent..."
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
fi

# Copy plist to LaunchAgents
cp "$PLIST_SOURCE" "$PLIST_DEST"

# Update the path in plist to match current project location
sed -i '' "s|/Users/admin/homelab/jeopardy|$PROJECT_DIR|g" "$PLIST_DEST"

# Load the agent
launchctl load "$PLIST_DEST"

# Verify it's loaded
if launchctl list | grep -q "^${PLIST_NAME}$"; then
    echo "✅ Automated backups enabled!"
    echo ""
    echo "📅 Schedule: Every Sunday at 3:00 AM"
    echo "📁 Backups: $PROJECT_DIR/backups/"
    echo "📝 Logs: $PROJECT_DIR/backups/backup.log"
    echo ""
    echo "Commands:"
    echo "  Run now:      launchctl start $PLIST_NAME"
    echo "  Check status: launchctl list | grep $PLIST_NAME"
    echo "  View logs:    tail -f $PROJECT_DIR/backups/backup.log"
else
    echo "❌ Error: Failed to load launch agent"
    exit 1
fi

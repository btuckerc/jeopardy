#!/bin/bash
#
# Disable automated database backups on macOS
# Unloads and removes the launchd agent
#

set -euo pipefail

PLIST_NAME="com.trivrdy.backup"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

echo "🛑 Disabling trivrdy automated backups..."

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ Error: This script is designed for macOS only"
    exit 1
fi

# Check if agent is loaded
if launchctl list | grep -q "^${PLIST_NAME}$"; then
    echo "📴 Unloading launch agent..."
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    echo "✅ Launch agent unloaded"
else
    echo "ℹ️  Launch agent was not running"
fi

# Remove plist file if it exists
if [[ -f "$PLIST_PATH" ]]; then
    rm "$PLIST_PATH"
    echo "🗑️  Removed launch agent plist"
fi

echo ""
echo "✅ Automated backups disabled"
echo ""
echo "Note: Manual backups still work:"
echo "  ./scripts/backup-database.sh"

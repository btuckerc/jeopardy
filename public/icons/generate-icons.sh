#!/bin/bash

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is required but not installed."
    echo "Please install ImageMagick first:"
    echo "  macOS: brew install imagemagick"
    echo "  Ubuntu/Debian: sudo apt-get install imagemagick"
    exit 1
fi

# Check if source image is provided
if [ -z "$1" ]; then
    echo "Error: Please provide a source image."
    echo "Usage: ./generate-icons.sh <source-image>"
    exit 1
fi

# Create icons directory if it doesn't exist
mkdir -p "$(dirname "$0")"

# Generate PWA icons
convert "$1" -resize 192x192 "$(dirname "$0")/icon-192.png"
convert "$1" -resize 512x512 "$(dirname "$0")/icon-512.png"

# Generate Apple touch icons
convert "$1" -resize 180x180 "$(dirname "$0")/apple-touch-icon.png"

echo "Icons generated successfully!" 
#!/bin/bash

# Android Icon & Splash Screen Generator
# This script generates all required Android app icons and splash screens

echo "🎨 Generating Android Icons & Splash Screens..."

cd "$(dirname "$0")"

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ Error: ImageMagick is not installed"
    echo "Please install it: sudo apt-get install imagemagick"
    exit 1
fi

# Source icon (should be at least 1024x1024)
SOURCE_ICON="resources/icon.png"
SOURCE_SPLASH="resources/splash.png"

if [ ! -f "$SOURCE_ICON" ]; then
    echo "❌ Error: icon.png not found in resources folder"
    exit 1
fi

echo "✅ Source icon found: $SOURCE_ICON"

# Create Android resource directories if they don't exist
mkdir -p android/app/src/main/res/mipmap-mdpi
mkdir -p android/app/src/main/res/mipmap-hdpi
mkdir -p android/app/src/main/res/mipmap-xhdpi
mkdir -p android/app/src/main/res/mipmap-xxhdpi
mkdir -p android/app/src/main/res/mipmap-xxxhdpi
mkdir -p android/app/src/main/res/drawable
mkdir -p android/app/src/main/res/drawable-land-mdpi
mkdir -p android/app/src/main/res/drawable-land-hdpi
mkdir -p android/app/src/main/res/drawable-land-xhdpi
mkdir -p android/app/src/main/res/drawable-land-xxhdpi
mkdir -p android/app/src/main/res/drawable-land-xxxhdpi
mkdir -p android/app/src/main/res/drawable-port-mdpi
mkdir -p android/app/src/main/res/drawable-port-hdpi
mkdir -p android/app/src/main/res/drawable-port-xhdpi
mkdir -p android/app/src/main/res/drawable-port-xxhdpi
mkdir -p android/app/src/main/res/drawable-port-xxxhdpi

echo "📱 Generating launcher icons..."

# Generate launcher icons with proper sizing and padding
# Keep aspect ratio and add padding for better appearance
convert "$SOURCE_ICON" -resize 40x40 -background none -gravity center -extent 48x48 android/app/src/main/res/mipmap-mdpi/ic_launcher.png
convert "$SOURCE_ICON" -resize 60x60 -background none -gravity center -extent 72x72 android/app/src/main/res/mipmap-hdpi/ic_launcher.png
convert "$SOURCE_ICON" -resize 80x80 -background none -gravity center -extent 96x96 android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
convert "$SOURCE_ICON" -resize 120x120 -background none -gravity center -extent 144x144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
convert "$SOURCE_ICON" -resize 160x160 -background none -gravity center -extent 192x192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png

# Generate round icons
convert "$SOURCE_ICON" -resize 40x40 -background none -gravity center -extent 48x48 android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png
convert "$SOURCE_ICON" -resize 60x60 -background none -gravity center -extent 72x72 android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png
convert "$SOURCE_ICON" -resize 80x80 -background none -gravity center -extent 96x96 android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png
convert "$SOURCE_ICON" -resize 120x120 -background none -gravity center -extent 144x144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png
convert "$SOURCE_ICON" -resize 160x160 -background none -gravity center -extent 192x192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png

echo "🎭 Generating splash screens..."

# Portrait splash screens - with larger, more visible logo
convert -size 320x480 canvas:'#667eea' "$SOURCE_ICON" -resize 200x200 -gravity center -composite android/app/src/main/res/drawable-port-mdpi/splash.png
convert -size 480x800 canvas:'#667eea' "$SOURCE_ICON" -resize 300x300 -gravity center -composite android/app/src/main/res/drawable-port-hdpi/splash.png
convert -size 720x1280 canvas:'#667eea' "$SOURCE_ICON" -resize 450x450 -gravity center -composite android/app/src/main/res/drawable-port-xhdpi/splash.png
convert -size 960x1600 canvas:'#667eea' "$SOURCE_ICON" -resize 600x600 -gravity center -composite android/app/src/main/res/drawable-port-xxhdpi/splash.png
convert -size 1280x1920 canvas:'#667eea' "$SOURCE_ICON" -resize 800x800 -gravity center -composite android/app/src/main/res/drawable-port-xxxhdpi/splash.png

# Landscape splash screens - with larger, more visible logo
convert -size 480x320 canvas:'#667eea' "$SOURCE_ICON" -resize 200x200 -gravity center -composite android/app/src/main/res/drawable-land-mdpi/splash.png
convert -size 800x480 canvas:'#667eea' "$SOURCE_ICON" -resize 300x300 -gravity center -composite android/app/src/main/res/drawable-land-hdpi/splash.png
convert -size 1280x720 canvas:'#667eea' "$SOURCE_ICON" -resize 450x450 -gravity center -composite android/app/src/main/res/drawable-land-xhdpi/splash.png
convert -size 1600x960 canvas:'#667eea' "$SOURCE_ICON" -resize 600x600 -gravity center -composite android/app/src/main/res/drawable-land-xxhdpi/splash.png
convert -size 1920x1280 canvas:'#667eea' "$SOURCE_ICON" -resize 800x800 -gravity center -composite android/app/src/main/res/drawable-land-xxxhdpi/splash.png

# Default splash - large and centered
convert -size 2732x2732 canvas:'#667eea' "$SOURCE_ICON" -resize 800x800 -gravity center -composite android/app/src/main/res/drawable/splash.png

echo "✅ Done! All icons and splash screens generated."
echo ""
echo "Next steps:"
echo "1. Run: npx cap sync android"
echo "2. Rebuild your APK"
echo ""

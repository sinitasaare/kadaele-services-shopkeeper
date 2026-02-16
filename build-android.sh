#!/bin/bash

echo "🚀 Building Kadaele POS Android APK..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Build web assets
echo "🔨 Building web assets..."
npm run build
echo ""

# Check if Capacitor CLI is available
if ! command -v cap &> /dev/null; then
    echo "📦 Installing Capacitor CLI..."
    npm install -g @capacitor/cli
    echo ""
fi

# Add Android platform if not exists
if [ ! -d "android" ]; then
    echo "📱 Adding Android platform..."
    npx cap add android
    echo ""
fi

# Sync Capacitor
echo "🔄 Syncing Capacitor..."
npx cap sync android
echo ""

# Build APK (UNIVERSAL - 1 APK only)
echo "🏗️  Building Android APK..."
cd android
chmod +x gradlew
./gradlew assembleUniversalDebug
cd ..
echo ""

# Check if APK was created
if [ -f "android/app/build/outputs/apk/debug/app-universal-debug.apk" ]; then
    echo "✅ SUCCESS! APK built successfully!"
    echo ""
    echo "📍 APK Location: android/app/build/outputs/apk/debug/app-universal-debug.apk"
    echo ""
    echo "📲 You can now install this APK on your Android device."
    echo ""

    # Copy APK to root for easy access
    cp android/app/build/outputs/apk/debug/app-universal-debug.apk ./kadaele-pos-debug.apk
    echo "📋 APK also copied to: ./kadaele-pos-debug.apk"
else
    echo "❌ Build failed. Check the output above for errors."
    exit 1
fi
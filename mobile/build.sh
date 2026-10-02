#!/bin/bash

# Build script for Dobha Dobha app with Google Sign-In configuration
# Usage: ./build.sh [apk|aab] [release|debug]

BUILD_TYPE=${1:-apk}
BUILD_MODE=${2:-release}

cd "$(dirname "$0")"

echo "Building Flutter app ($BUILD_TYPE, $BUILD_MODE) with Google Sign-In config..."
flutter build "$BUILD_TYPE" --"$BUILD_MODE" --dart-define-from-file=config/google.json

echo "Build complete!"

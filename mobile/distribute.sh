#!/bin/bash

# Script to build and distribute the app to Firebase App Distribution locally
# Usage: ./distribute.sh [apk|aab] [release_notes]
# Requires: Firebase CLI (npm install -g firebase-tools)

set -e

BUILD_TYPE=${1:-apk}
RELEASE_NOTES=${2:-"Manual release from local build"}

cd "$(dirname "$0")"

echo "Building Flutter app ($BUILD_TYPE)..."
if [ "$BUILD_TYPE" = "aab" ]; then
  flutter build appbundle --release
  OUTPUT_PATH="build/app/outputs/bundle/release/app-release.aab"
else
  flutter build apk --release
  OUTPUT_PATH="build/app/outputs/flutter-apk/app-release.apk"
fi

echo "Uploading to Firebase App Distribution using Firebase CLI..."
firebase appdistribution:distribute "$OUTPUT_PATH" \
  --app 1:787923055628:android:4e2787b23f9f600c7f2a29 \
  --release-notes "$RELEASE_NOTES" \
  --testers "ndlovubhekani17@gmail.com" \
  --groups "default"

echo "Distribution complete!"
echo "Output: $OUTPUT_PATH"

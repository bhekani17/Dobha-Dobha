#!/bin/bash

# Script to build and distribute the app to Firebase App Distribution locally
# Usage: ./distribute.sh [apk|aab] [release_notes]
# Requires: Firebase CLI (npm install -g firebase-tools)

set -e

BUILD_TYPE=${1:-apk}
RELEASE_NOTES=${2:-"Manual release from local build"}

if [[ -z "$API_BASE_URL" || ! "$DEPLOYMENT_STAGE" =~ ^(dev|prod)$ ]]; then
  echo "Set API_BASE_URL and DEPLOYMENT_STAGE=dev|prod before distributing." >&2
  exit 1
fi
if [[ "$DEPLOYMENT_STAGE" == "prod" && ( "$API_BASE_URL" != https://* || "$API_BASE_URL" =~ /dev/?$ ) ]]; then
  echo "Production builds require an HTTPS API_BASE_URL that is not the dev stage." >&2
  exit 1
fi

cd "$(dirname "$0")"

echo "Building Flutter app ($BUILD_TYPE) with Google Sign-In config..."
if [ "$BUILD_TYPE" = "aab" ]; then
  flutter build appbundle --release --dart-define-from-file=config/google.json \
    --dart-define=DEPLOYMENT_STAGE="$DEPLOYMENT_STAGE" --dart-define=API_BASE_URL="$API_BASE_URL"
  OUTPUT_PATH="build/app/outputs/bundle/release/app-release.aab"
else
  flutter build apk --release --dart-define-from-file=config/google.json \
    --dart-define=DEPLOYMENT_STAGE="$DEPLOYMENT_STAGE" --dart-define=API_BASE_URL="$API_BASE_URL"
  OUTPUT_PATH="build/app/outputs/flutter-apk/app-release.apk"
fi

echo "Uploading to Firebase App Distribution using Firebase CLI..."
firebase appdistribution:distribute "$OUTPUT_PATH" \
  --app 1:787923055628:android:4e2787b23f9f600c7f2a29 \
  --release-notes "$RELEASE_NOTES" \
  --testers "ndlovubhekani17@gmail.com"

echo "Distribution complete!"
echo "Output: $OUTPUT_PATH"

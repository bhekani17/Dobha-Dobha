#!/bin/bash
set -e

# Build script for Dobha Dobha app with Google Sign-In configuration
# Usage: ./build.sh [apk|aab] [release|debug]

BUILD_TYPE=${1:-apk}
BUILD_MODE=${2:-release}

if [[ -z "$API_BASE_URL" || ! "$DEPLOYMENT_STAGE" =~ ^(dev|prod)$ ]]; then
  echo "Set API_BASE_URL and DEPLOYMENT_STAGE=dev|prod before building." >&2
  exit 1
fi
if [[ "$DEPLOYMENT_STAGE" == "prod" && ( "$API_BASE_URL" != https://* || "$API_BASE_URL" =~ /dev/?$ ) ]]; then
  echo "Production builds require an HTTPS API_BASE_URL that is not the dev stage." >&2
  exit 1
fi

cd "$(dirname "$0")"

echo "Building Flutter app ($BUILD_TYPE, $BUILD_MODE) with Google Sign-In config..."
flutter build "$BUILD_TYPE" --"$BUILD_MODE" \
  --dart-define-from-file=config/google.json \
  --dart-define=DEPLOYMENT_STAGE="$DEPLOYMENT_STAGE" \
  --dart-define=API_BASE_URL="$API_BASE_URL"

echo "Build complete!"

@echo off
REM Script to build and distribute the app to Firebase App Distribution locally (Windows)
REM Usage: distribute.bat [apk|aab] [release_notes]
REM Requires: Firebase CLI (npm install -g firebase-tools)

setlocal enabledelayedexpansion

set BUILD_TYPE=%1
if "%BUILD_TYPE%"=="" set BUILD_TYPE=apk

set RELEASE_NOTES=%2
if "%RELEASE_NOTES%"=="" set RELEASE_NOTES=Manual release from local build

cd /d "%~dp0"

echo Building Flutter app (%BUILD_TYPE%) with Google Sign-In config...
if "%BUILD_TYPE%"=="aab" (
  flutter build appbundle --release --dart-define-from-file=config/google.json
  set OUTPUT_PATH=build\app\outputs\bundle\release\app-release.aab
) else (
  flutter build apk --release --dart-define-from-file=config/google.json
  set OUTPUT_PATH=build\app\outputs\flutter-apk\app-release.apk
)

echo Uploading to Firebase App Distribution using Firebase CLI...
firebase appdistribution:distribute "!OUTPUT_PATH!" ^
  --app 1:787923055628:android:4e2787b23f9f600c7f2a29 ^
  --release-notes "!RELEASE_NOTES!" ^
  --testers "ndlovubhekani17@gmail.com" ^
  --groups "default"

echo Distribution complete!
echo Output: !OUTPUT_PATH!

endlocal

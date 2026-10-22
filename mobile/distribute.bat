@echo off
REM Script to build and distribute the app to Firebase App Distribution locally (Windows)
REM Usage: distribute.bat [apk|aab] [release_notes]
REM Requires: Firebase CLI (npm install -g firebase-tools)

setlocal enabledelayedexpansion

set BUILD_TYPE=%1
if "%BUILD_TYPE%"=="" set BUILD_TYPE=apk

set RELEASE_NOTES=%2
if "%RELEASE_NOTES%"=="" set RELEASE_NOTES=Manual release from local build

if "%API_BASE_URL%"=="" (
  echo Set API_BASE_URL and DEPLOYMENT_STAGE=dev or prod before distributing. 1>&2
  exit /b 1
)
if not "%DEPLOYMENT_STAGE%"=="dev" if not "%DEPLOYMENT_STAGE%"=="prod" (
  echo DEPLOYMENT_STAGE must be dev or prod. 1>&2
  exit /b 1
)
if "%DEPLOYMENT_STAGE%"=="prod" if not "%API_BASE_URL:~0,8%"=="https://" (
  echo Production builds require an HTTPS API_BASE_URL. 1>&2
  exit /b 1
)
if "%DEPLOYMENT_STAGE%"=="prod" if "%API_BASE_URL:~-4%"=="/dev" (
  echo Production builds cannot use the dev API stage. 1>&2
  exit /b 1
)
if "%DEPLOYMENT_STAGE%"=="prod" if "%API_BASE_URL:~-5%"=="/dev/" (
  echo Production builds cannot use the dev API stage. 1>&2
  exit /b 1
)

cd /d "%~dp0"

echo Building Flutter app (%BUILD_TYPE%) with Google Sign-In config...
if "%BUILD_TYPE%"=="aab" (
  flutter build appbundle --release --dart-define-from-file=config/google.json --dart-define=DEPLOYMENT_STAGE=%DEPLOYMENT_STAGE% --dart-define=API_BASE_URL=%API_BASE_URL%
  if errorlevel 1 exit /b 1
  set OUTPUT_PATH=build\app\outputs\bundle\release\app-release.aab
) else (
  flutter build apk --release --dart-define-from-file=config/google.json --dart-define=DEPLOYMENT_STAGE=%DEPLOYMENT_STAGE% --dart-define=API_BASE_URL=%API_BASE_URL%
  if errorlevel 1 exit /b 1
  set OUTPUT_PATH=build\app\outputs\flutter-apk\app-release.apk
)

echo Uploading to Firebase App Distribution using Firebase CLI...
firebase appdistribution:distribute "!OUTPUT_PATH!" ^
  --app 1:787923055628:android:4e2787b23f9f600c7f2a29 ^
  --release-notes "!RELEASE_NOTES!" ^
  --testers "ndlovubhekani17@gmail.com" ^
  --groups "default"
if errorlevel 1 exit /b 1

echo Distribution complete!
echo Output: !OUTPUT_PATH!

endlocal

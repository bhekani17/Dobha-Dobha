# Firebase App Distribution Setup Guide

This guide covers the complete setup for Firebase App Distribution for the Dobha Dobha app.

## What's Been Configured

### 1. Firebase App Distribution via Firebase CLI
- Distribution is handled using Firebase CLI (command-line tool)
- No SDK integration needed in the app code
- Simpler and more reliable than Gradle plugin integration

### 2. CI/CD Pipeline
- Created `.github/workflows/firebase-app-distribution.yml` for GitHub Actions
- Automatically builds and distributes on push to main/master
- Supports manual triggers with custom release notes and testers
- Uses Firebase CLI for upload

### 3. Local Distribution Scripts
- `mobile/distribute.sh` - Linux/Mac script for local distribution
- `mobile/distribute.bat` - Windows script for local distribution
- Both use Firebase CLI for upload

---

## Required Secrets for GitHub Actions

To use the CI/CD pipeline, add these secrets to your GitHub repository:

### 1. Keystore Secrets
Encode your keystore file to base64:
```bash
base64 -i /path/to/your/upload-keystore.jks | pbcopy  # Mac
base64 -w 0 /path/to/your/upload-keystore.jks          # Linux
```

Add to GitHub Secrets:
- `KEYSTORE_BASE64` - The base64-encoded keystore file
- `KEYSTORE_PASSWORD` - Your keystore password
- `KEY_ALIAS` - Your key alias (e.g., `upload` or `key`)
- `KEY_PASSWORD` - Your key password

### 2. Firebase Secrets
Encode your Firebase service account JSON:
```bash
base64 -i dobha-live-firebase-adminsdk-fbsvc-85de49de3b.json | pbcopy  # Mac
base64 -w 0 dobha-live-firebase-adminsdk-fbsvc-85de49de3b.json       # Linux
```

Add to GitHub Secrets:
- `FIREBASE_SERVICE_ACCOUNT` - The base64-encoded service account JSON
- `FIREBASE_APP_ID` - Your Firebase App ID: `1:787923055628:android:4e2787b23f9f600c7f2a29`

---

## Using the Distribution Scripts

### Local Distribution (Windows)
```bash
cd mobile
distribute.bat apk "Bug fixes and performance improvements"
distribute.bat aab "Release v1.0.1"
```

### Local Distribution (Linux/Mac)
```bash
cd mobile
chmod +x distribute.sh
./distribute.sh apk "Bug fixes and performance improvements"
./distribute.sh aab "Release v1.0.1"
```

---

## Tester Groups and Invite Links

### Creating Tester Groups
1. Go to [Firebase Console > App Distribution > Testers & Groups](https://console.firebase.google.com/project/dobha-live/appdistribution/app/android:com.dobhadobha.app/testers)
2. Click "Create group"
3. Name your group (e.g., "Internal Team", "Beta Testers")
4. Add testers by email address

### Creating Invite Links
1. Go to [Firebase Console > App Distribution > Invite links](https://console.firebase.google.com/project/dobha-live/appdistribution/app/android:com.dobhadobha.app/invite_links)
2. Click "Create invite link"
3. Select the tester group
4. Copy the generated link and share with your testers

### Managing Testers
- Add individual testers: Enter their email in the "Testers & Groups" section
- Add groups: Create groups and add multiple testers at once
- Remove testers: Click the trash icon next to their email

---

## In-App Update Flow

Firebase App Distribution provides automatic update notifications to testers via email and the Firebase App Distribution tester app. Testers will:

1. Receive an email notification when a new release is available
2. Open the email link or check the Firebase App Distribution tester app
3. Download and install the new version directly

Note: For in-app update prompts (SDK integration), you would need to add the `firebase_app_distribution` plugin, but this can cause build conflicts. The Firebase CLI approach is simpler and more reliable for distribution.

---

## Manual Distribution via Firebase Console

If you prefer manual distribution:
1. Go to [Firebase Console > App Distribution > Releases](https://console.firebase.google.com/project/dobha-live/appdistribution/app/android:com.dobhadobha.app/releases)
2. Drag and drop your APK or AAB file
3. Add release notes
4. Select testers or groups
5. Click "Distribute"

---

## Troubleshooting

### Build Fails with Signing Errors
- Ensure `key.properties` exists in `mobile/android/`
- Verify the keystore file path is correct
- Check that passwords and alias match your keystore

### Distribution Upload Fails
- Verify the Firebase service account JSON is valid
- Ensure the service account has "Firebase App Distribution Admin" role
- Check that `FIREBASE_APP_ID` is correct

### In-App Updates Not Showing
- Ensure the app is signed with the same key as the distributed version
- Verify the version code in `pubspec.yaml` is higher than the previous release
- Check that the device is registered as a tester in Firebase Console

### Gradle Plugin Errors
- Ensure you're using Java 17 or higher
- Update Gradle wrapper if needed: `cd mobile/android && ./gradlew wrapper --gradle-version=8.3`

---

## Version Management

Update the version in `mobile/pubspec.yaml` before each release:
```yaml
version: 1.0.1+2  # versionName+versionCode
```

- `versionName` (1.0.1): Human-readable version
- `versionCode` (2): Incrementing integer for Play Store

---

## Security Notes

- **Never commit** `key.properties`, `upload-keystore.jks`, or any credentials to git
- **Never commit** the Firebase service account JSON (already in .gitignore)
- Use GitHub Secrets for CI/CD credentials
- Rotate keystore passwords if compromised
- Limit service account permissions to only what's needed

---

## Next Steps

1. ✅ Firebase CLI distribution setup (completed)
2. ✅ CI/CD pipeline setup (completed)
3. ✅ Local distribution scripts (completed)
4. ⏳ Install Firebase CLI locally: `npm install -g firebase-tools`
5. ⏳ Login to Firebase: `firebase login`
6. ⏳ Add GitHub Secrets
7. ⏳ Test local distribution
8. ⏳ Test CI/CD pipeline
9. ⏳ Set up tester groups
10. ⏳ Create first automated release

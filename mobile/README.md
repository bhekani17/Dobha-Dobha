# Dobha Dobha mobile app

The mobile client is a Flutter application for browsing listings, messaging,
and live streams. It currently uses the existing API configured in the app;
the separate ECS/PostgreSQL API is not a production client target yet.

## Financial features

Checkout, payment, escrow settlement, wallet deposits and withdrawals, and
paid listing promotion are unavailable. The backend rejects these operations;
the app does not process payments or hold funds. Historical order, wallet, and
transaction records are not proof of payment, delivery, refund, or payout.
Do not send money to a seller based on an in-app balance or order record.

## Development

Install Flutter using the official Flutter setup guide. From this directory:

```sh
flutter pub get
flutter analyze
flutter test
```

### Run on an Android phone

Enable Developer options and USB debugging on the phone, connect it by USB,
then run from this directory:

```sh
flutter devices
flutter run --dart-define-from-file=config/google.json --dart-define=DEPLOYMENT_STAGE=dev --dart-define=API_BASE_URL=https://4mvo7623gl.execute-api.af-south-1.amazonaws.com/dev
```

To create a debug APK for direct installation:

```sh
flutter build apk --debug --dart-define-from-file=config/google.json --dart-define=DEPLOYMENT_STAGE=dev --dart-define=API_BASE_URL=https://4mvo7623gl.execute-api.af-south-1.amazonaws.com/dev
adb install -r build/app/outputs/flutter-apk/app-debug.apk
```

The `build.sh`, `build.bat`, `distribute.sh`, and `distribute.bat` scripts
require `API_BASE_URL` and `DEPLOYMENT_STAGE` environment variables.
Production builds reject development API URLs and require HTTPS. The existing
Firebase workflow builds for tester distribution against `dev`; it is not a
store-production release.

The APK is for testing on your own device. Google Sign-In for Android depends
on the app package name and signing certificate SHA registered in Firebase /
Google Cloud. If sign-in reports a developer configuration error, add the
SHA-1 of the signing key used for that build to the Android OAuth client and
download the updated `google-services.json`.

### Sign in and host a live stream

Use **Continue with Google** on the welcome screen. In the app, open **Live
Studio** and choose **Start Selling** to create a vendor profile. Then return
to **Live Studio**, enter a stream name if desired, and choose **Go Live**.
Allow camera and microphone access when prompted. Live streaming is available
only while the configured LiveKit service and API are reachable.

Set `DEPLOYMENT_STAGE` and `API_BASE_URL` as Dart defines for native builds.
`lib/api.dart` rejects a production API target that uses the dev stage or
non-HTTPS. Google OAuth client IDs are provided at build time from
`config/google.json`. These IDs are public client configuration, not server
secrets. Do not point production builds at the ECS API until its route,
authentication, data, and operational parity work is complete and approved.

The public legal pages in `web/terms.html` and `web/privacy.html` are generated
from `lib/legal/terms.dart` and `lib/legal/privacy.dart`:

```sh
python tool/build_legal_pages.py
```

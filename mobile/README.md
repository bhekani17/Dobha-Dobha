# Dobha Dobha mobile app

The mobile client is a Flutter application for browsing listings, messaging,
and live streams. It currently uses the existing API configured in the app;
the separate ECS/PostgreSQL API is not a production client target yet.

## Financial features

Checkout, wallet deposits/withdrawals, order fulfillment, escrow settlement,
and payouts are unavailable. The app does not collect payment or bank details.
Historical order and wallet records may contain demo or legacy state and do not
verify that money was paid, held, refunded, or transferred. See the in-app
Terms, Privacy, and Help screens for the user-facing policy.

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
flutter run --dart-define-from-file=config/google.json
```

To create a debug APK for direct installation:

```sh
flutter build apk --debug --dart-define-from-file=config/google.json
adb install -r build/app/outputs/flutter-apk/app-debug.apk
```

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
only while the configured LiveKit service and API are reachable. Checkout,
paid claims, and wallet transactions remain disabled.

The API base is configured in `lib/api.dart`; Google OAuth client IDs are
provided at build time from `config/google.json`. These IDs are public client
configuration, not server secrets. Do not point production builds at the ECS
API until its route, authentication, data, and operational parity work is
complete and approved.

The public legal pages in `web/terms.html` and `web/privacy.html` are generated
from `lib/legal/terms.dart` and `lib/legal/privacy.dart`:

```sh
python tool/build_legal_pages.py
```

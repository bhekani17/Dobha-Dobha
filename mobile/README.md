# Dobha Dobha mobile app

The mobile client is a Flutter application for browsing listings, messaging,
and live streams. It currently uses the existing API configured in the app;
the separate ECS/PostgreSQL API is not a production client target yet.

## Checkout and financial features

The dev environment supports provider sandbox checkout from the bag or listing
screen. A buyer sends a test order request, the seller accepts it, then the
buyer can open the provider sandbox checkout from Orders. Order cards expose
manual test preparation, dispatch/handoff, and completion reports. The app
labels these orders SANDBOX; they are not Dobha orders with verified payment or
delivery.

PayFast sandbox is enabled on dev. Escrow sandbox is available only when its
provider credentials are configured and the dev deployment enables it. Do not
use live provider credentials in the app. The app does not credit a Dobha
wallet or release funds to a seller. Wallet deposits and withdrawals, voucher
funding, cash on delivery, refunds, real delivery verification, seller payouts,
and paid listing promotion remain unavailable. Historical order, wallet, and
transaction records are not evidence of real payment, delivery, refund, or
payout.

Use an available listing and a second account acting as its seller to test the
full flow. Direct purchase requests remain available for arranging an off-app
transaction and do not create an order or verify payment.

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

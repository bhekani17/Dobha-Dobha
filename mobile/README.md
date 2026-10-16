# Dobha Flutter application

The app supports marketplace browsing, listings, live selling, offers, chat,
orders and a simulated wallet. The source declares Dart `^3.12.2`; the current
lockfile also requires Flutter `>=3.38.4`. Install a Flutter release whose bundled
Dart satisfies the declared constraint, then run from `mobile/`:

```bash
flutter pub get
flutter analyze
flutter run --dart-define-from-file=config/google.json
```

`config/google.json` contains public OAuth client IDs, not private credentials.
Firebase configuration supports mobile push. Live selling currently uses
LiveKit. Native Android/iOS builds additionally need their platform SDKs and the
appropriate signing configuration. Release helpers are in `build.sh`/`build.bat`;
Firebase tester distribution is documented in
[the distribution guide](../FIREBASE_DISTRIBUTION_SETUP.md).

## API configuration and AWS migration

`lib/api.dart` reads `API_BASE_URL` at build time. Native builds currently default
to the existing API; Flutter web uses its current origin. For an isolated
integration build against a feature-complete AWS deployment, use its CloudFront
origin:

```bash
flutter run --dart-define=API_BASE_URL=https://YOUR-CLOUDFRONT-DOMAIN --dart-define-from-file=config/google.json
```

An endpoint override alone does not migrate the app: Cognito confirmation,
session refresh, the S3 upload protocol, social features and live hosting still
need client/server integration. Do not distribute an AWS-configured build to
existing users before [the migration gates](../server/marketplace-prototype/MIGRATION.md)
pass. Keep the default endpoint until then.

Marketplace state currently lives in `lib/state/app_state.dart`; the Cognito
migration should extract session storage and refresh handling into a dedicated
service, with tests for expired tokens and simultaneous refresh attempts. Real
payment collection and payouts are not implemented.

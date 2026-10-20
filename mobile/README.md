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

The active API configuration and Google sign-in setup are in the existing app
configuration. Do not point production builds at the ECS API until its route,
authentication, data, and operational parity work is complete and approved.

The public legal pages in `web/terms.html` and `web/privacy.html` are generated
from `lib/legal/terms.dart` and `lib/legal/privacy.dart`:

```sh
python tool/build_legal_pages.py
```

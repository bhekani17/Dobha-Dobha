# Dobha Dobha

```
Dobha-Dobha/
  server/       Cloudflare Worker: the API (accounts, listings, orders, wallet, live tokens),
                item photos, and host for the Flutter web build
  mobile/       Flutter app (Android, iOS, web)
```

## What's real and what's simulated

Everything is stored on the server: accounts, listings and photos, likes, saves, comments,
orders and their escrow status, wallet balances and transaction history.

Only **payments** are simulated. Paying with Capitec Pay, Ozow or a card succeeds instantly
without contacting a provider, top-ups add money that was never charged, and withdrawals never
reach a bank. Wallet payments do check and deduct the stored balance. Replace the simulated
parts in `server/src/orders.js` when a payment provider is connected.

## Deploying

Video goes through LiveKit Cloud. Data lives in Cloudflare D1 (`dobha`) and photos in R2
(`dobha-photos`); both are bound in `server/wrangler.jsonc`.

1. LiveKit Cloud: create a project at https://cloud.livekit.io and copy its URL, API key and secret.
2. Set them as Worker secrets (once), from `server/`:
   ```
   npx wrangler secret put LIVEKIT_URL          (wss://<project>.livekit.cloud)
   npx wrangler secret put LIVEKIT_API_KEY
   npx wrangler secret put LIVEKIT_API_SECRET
   ```
3. Apply database migrations: `npm run db:migrate`
4. Deploy: `npm run deploy` (builds the Flutter web app, then deploys it with the Worker).
5. Build the phone app against it:
   `flutter build apk --release --dart-define-from-file=config/google.json`
   The app always talks to the live Worker (`liveServerUrl` in `mobile/lib/api.dart`); the web app is
   served by the Worker and calls it on the same origin.

## API

All routes are under `/api` and, apart from register and login, need `Authorization: Bearer <token>`.

| Area | Routes |
|---|---|
| Accounts | `POST auth/register`, `POST auth/login`, `POST auth/logout`, `GET me`, `PATCH me` |
| Listings | `GET items`, `GET items/:id`, `GET items/mine`, `POST items`, `DELETE items/:id`, `POST uploads` |
| Social | `POST items/:id/like`, `POST items/:id/save`, `GET saved`, `GET/POST items/:id/comments` |
| Orders | `GET orders`, `POST orders`, `POST orders/:id/dispatch`, `.../confirm`, `.../dispute` |
| Wallet | `GET wallet`, `POST wallet/topup`, `POST wallet/withdraw` |
| Live | `GET rooms`, `GET token?room=&role=host\|viewer` |

Photos are served publicly from `/photos/<key>`.

What the server enforces:
- Passwords are hashed with PBKDF2; sessions are random tokens stored only as hashes and expire after 60 days.
  Login and register are rate limited per IP (10/min).
- Only vendors (with a shop name and stall) can list items, upload photos or go live.
- An item can only be claimed once; the claim and the stock change happen atomically.
- Only the seller can mark an order dispatched; only the buyer can confirm or dispute it.
  Confirming pays the seller the price minus a 5% Dobha fee.
- Couriers need the real tracking number when the seller dispatches; Safe Hub collections don't.
- A disputed order stays frozen until an admin refunds the buyer or pays the seller. Admins are
  the accounts listed in `ADMIN_EMAILS` in `server/wrangler.jsonc`. The admin website is
  `/admin` on the Worker (source: `mobile/web/admin/index.html`, copied into the web build); it
  lists open disputes and reported listings. The phone app has no admin screens.
- Sales, dispatches, payouts, disputes and comments create in-app notifications. The app polls
  for them every 30 seconds and when it comes back to the foreground (no push notifications yet).
- A daily cron deletes expired sessions and uploads that were never attached to a listing.
- A stream name can only have one host (a Durable Object holds the lock across every Cloudflare
  location), and viewers can only join streams that are live.

## Android release signing

The app ID is `com.dobhadobha.app`. Release builds are signed with the upload key named in
`mobile/android/key.properties` (git-ignored). Without that file they fall back to the debug key.
Back up the keystore and `key.properties` somewhere safe: Play App Signing can reset a lost
upload key, but it takes a support request and a few days.

Google sign-in on Android needs an OAuth client of type Android in Google Cloud, with package
`com.dobhadobha.app` and the SHA-1 of the key that signed the build (the upload key for local
release builds, and the Play app signing key from Play Console for installs from the Play Store).

Play Store bundle: `flutter build appbundle --release --dart-define-from-file=config/google.json`

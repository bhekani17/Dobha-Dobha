# Dobha Dobha Live

```
Dobha-Dobha/
  server/       Cloudflare Worker: LiveKit token server (+ web host/viewer pages in public/)
  mobile/       Flutter app (Android + iOS)
```

## Run locally

1. LiveKit (terminal 1): `cd server` then `npm run livekit`
2. Token server (terminal 2): `cd server`, copy `.dev.vars.example` to `.dev.vars`, then `npm start`,
   which serves http://localhost:3000
3. App: `cd mobile` then `flutter run --dart-define=SERVER_URL=http://<your-pc-ip>:3000`

The phone must be on the same Wi-Fi as the PC. Find the PC's IP with `ipconfig`.

## Going online (many users)

Video goes through LiveKit Cloud; the Worker only hands out tokens and the live list.

1. LiveKit Cloud: create a project at https://cloud.livekit.io and copy its URL, API key and secret.
2. Set them as Worker secrets (once), from `server/`:
   ```
   npx wrangler secret put LIVEKIT_URL          (wss://<project>.livekit.cloud)
   npx wrangler secret put LIVEKIT_API_KEY
   npx wrangler secret put LIVEKIT_API_SECRET
   ```
3. Deploy: `npm run deploy`. Until the secrets are set, the Worker answers
   "Server not configured" instead of signing tokens with the public dev keys.
4. Build the app against it:
   `flutter build apk --release --dart-define=SERVER_URL=https://dobha-live.<your-subdomain>.workers.dev`

What the server enforces (there are no accounts yet):
- A stream name can only have one host; a second "Go live" with the same name is refused
  (a Durable Object holds the lock, so this works across every Cloudflare location).
- Viewers can only join streams that are live.
- Names can repeat; each person gets a unique LiveKit identity, so nobody gets kicked out.
- `/rooms` is cached for 3s and `/token` is rate limited per IP (60/min).

# Dobha Dobha Live

```
Dobha-Dobha/
  server/       Node/Express token server for LiveKit (+ web host/viewer pages in public/)
  mobile/       Flutter app (Android + iOS)
```

## Run locally

1. LiveKit (terminal 1): `cd server` then `npm run livekit`
2. Token server (terminal 2): `cd server` then `npm start`, which serves http://localhost:3000
3. App: press F5 in VS Code ("Dobha Live (phone)"), or
   `cd mobile` then `flutter run --dart-define=SERVER_URL=http://<your-pc-ip>:3000`

The phone must be on the same Wi-Fi as the PC. Find the PC's IP with `ipconfig`.

Config lives in `server/.env` (copy from `server/.env.example`).

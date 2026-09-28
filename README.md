# DOBHA DOBHA (Local Street Marketplace)

> South Africa's authentic Johannesburg street thrifting marketplace — *ukudobha* ("pick it up" from the floor in street culture).

## 🚀 Tech Stack

- **Mobile App**: **React Native** (iOS & Android) with clean navigation and zero-emoji vector icons.
- **Backend**: **Node.js** (Express REST API with Escrow QR generation, Live Stream Dibs engine, and Neon PostgreSQL/Neon Object Storage integration).
- **Database**: **Neon PostgreSQL** (Lakebase Postgres) with Prisma ORM.
- **Authentication**: **Neon Auth** (Managed Better Auth) and JWT tokens.
- **Storage**: **Neon Object Storage** (S3-compatible) for file uploads.
- **Brand Verification**: Powered by **Logo.dev** API (`pk_YATscD2-Rx6ItVMsD1ElFw`).

---

## 📁 Project Architecture

```
sky-local-trade/
├── server/                   # Node.js Express REST API & Backend
│   ├── server.js             # Express app entry point
│   ├── dynamo.js             # AWS DynamoDB client
│   ├── setup-dynamo.js       # DynamoDB table initialization
│   ├── middleware/           # Auth validation
│   └── routes/               # Escrow, streams, auth, items, brand-logo
├── mobile/                   # React Native Application (Android & iOS)
│   ├── assets/               # App icons and graphics
│   ├── src/                  # Mobile screens, components, navigation, theme
│   ├── app.json              # Android & iOS bundle config
│   └── package.json          # React Native dependencies
├── prisma/                   # Database schema and migrations
│   ├── schema.prisma         # Prisma schema definition
│   └── migrations/           # Database migration files
├── .agents/                  # Agent skills and configuration
└── package.json              # Root scripts orchestrator
```

---

## 🏃 Quick Start

### 1. Start Node.js Backend
```bash
npm run server
# Server running at http://localhost:3000
```

### 2. Start React Native Mobile App
```bash
npm run mobile
# Or for target platform:
npm run mobile:android
npm run mobile:ios
```

---

## 🔒 Key Features
- **90-Second Dibs Reservation**: Instant hold timer prevents order sniping during live bale drops.
- **Cashless Escrow Vault**: 6-digit pickup PIN (`SK-XXXXXX`) and dynamic QR code presented at Bree Taxi Rank / Park Station.
- **South African KYC**: Automated Smart ID & Barcoded Green ID Book validation.
- **Direct Bank Payouts**: Automated payouts to Capitec, FNB, Standard Bank, and Nedbank upon QR scan.
- **Live Street Streaming**: Real-time broadcasts with instant bale drops and 90-second Dibs holds (Broadcasters and interactive participants must be authenticated and logged in).

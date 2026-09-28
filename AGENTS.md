# DOBHA DOBHA - Project Documentation

## Project Overview
South Africa's authentic Johannesburg street thrifting marketplace — *ukudobha* ("pick it up" from the floor in street culture).

## Tech Stack
- **Mobile App**: React Native (iOS & Android) with clean navigation and zero-emoji vector icons
- **Backend**: Node.js (Express REST API with Escrow QR generation, Live Stream Dibs engine, and Neon PostgreSQL/Neon Object Storage integration)
- **Database**: Neon PostgreSQL (Lakebase Postgres) with Prisma ORM
- **Authentication**: Neon Auth (Managed Better Auth) and JWT tokens
- **Storage**: Neon Object Storage (S3-compatible) for file uploads
- **Brand Verification**: Powered by Logo.dev API

## Architecture
```
sky-local-trade/
├── server/                   # Node.js Express REST API & Backend
│   ├── server.js             # Express app entry point
│   ├── prisma.js             # Prisma client with Neon connection pooling
│   ├── s3.js                 # Neon Object Storage client with presigned URLs
│   ├── middleware/           # Auth validation (JWT + Neon Auth support)
│   └── routes/               # Escrow, streams, auth, items, upload
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

## Build & Run Commands

### Backend
```bash
npm run server          # Start Node.js backend server
npm run prisma:generate # Generate Prisma client
npm run prisma:migrate  # Run database migrations
npm run prisma:studio   # Open Prisma Studio
```

### Mobile
```bash
npm run mobile          # Start React Native development server
npm run mobile:android  # Start for Android
npm run mobile:ios      # Start for iOS
```

## Key Features
- **90-Second Dibs Reservation**: Instant hold timer prevents order sniping during live bale drops
- **Cashless Escrow Vault**: 6-digit pickup PIN (`SK-XXXXXX`) and dynamic QR code presented at Bree Taxi Rank / Park Station
- **South African KYC**: Automated Smart ID & Barcoded Green ID Book validation
- **Direct Bank Payouts**: Automated payouts to Capitec, FNB, Standard Bank, and Nedbank upon QR scan
- **Live Streaming**: Real-time street broadcasts with instant product drops and Dibs. **MANDATORY RULE**: To be live (start a stream / broadcast), drop pieces to live bales, claim Dibs, or chat, a user MUST be logged in / authenticated.
- **Google Authentication**: OAuth integration with Neon Auth backend

## Environment Configuration
Key environment variables needed:
- `DATABASE_URL` / `DIRECT_URL`: Neon PostgreSQL connection strings
- `NEON_AUTH_BASE_URL` / `NEON_AUTH_JWKS_URL`: Neon Auth endpoints
- `AWS_*`: Neon Object Storage credentials
- `JWT_SECRET` / `JWT_REFRESH_SECRET`: JWT token secrets
- `EXPO_PUBLIC_API_URL`: Backend API URL for mobile app
- `EXPO_PUBLIC_*_GOOGLE_CLIENT_ID`: Google OAuth client IDs

## Database Schema
Core models: User, Item, ItemImage, Message, EscrowOrder, SellerWallet, UserVerification, Stream, StreamChat

## Database Setup
The database tables need to be created via Prisma migrations. Run:
```bash
npm run prisma:migrate    # Create and apply migrations
npm run prisma:generate   # Generate Prisma client
npm run prisma:studio     # View database in browser
```

If migrations fail, ensure DATABASE_URL is properly configured in .env file pointing to your Neon PostgreSQL instance.

## Authentication Flow
1. Email/password registration → JWT tokens issued
2. Google OAuth → Backend callback → JWT tokens issued
3. JWT tokens stored in mobile SecureStore
4. Token refresh via refresh token endpoint
5. Neon Auth integration for future OAuth providers
6. Live Streaming Auth Guard: Users must be logged in to broadcast live ("Go Live"), drop pieces into live bales, claim 90-second Dibs, or send live stream chats

## Storage Strategy
- Primary: Neon Object Storage (S3-compatible)
- Fallback: Local disk storage (uploads/ directory)
- Presigned URLs for secure access
- Supports images, videos, and documents
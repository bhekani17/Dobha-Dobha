# Marketplace website

This directory contains the React/Vite website, built to static files for hosting from a private Amazon S3 bucket through CloudFront; see [the server deployment guide](../server/README.md). `src/legacy.html` remains the single source of the existing marketplace markup while interactive features are progressively migrated to React components; it is not a second separately maintained website. The Discover page is a React feed with vertical listing navigation, horizontal photo/video galleries, story links, listing actions, and cursor-based pagination. Existing account, chat, seller, and live-stream flows remain wired through the shared website application.

The homepage puts current live streams and popular listings near the top so
visitors can see who is live and what is getting attention. Live status and
popular listings come from the marketplace API; “popular” is ordered by listing
likes and is not a sales or transaction claim.

Signed-in sellers can preview their public shop and manage their listings,
including viewing listing photos and the optional product video. A listing
requires at least one photo and supports up to one product video.

The messages page uses a conversation list and chat bubbles for buyer/seller
messages. The live studio expands to a full-window view when a host goes live,
with camera, microphone, end-stream, and chat controls floating over the stream.

The homepage uses credited, optimized Johannesburg photography; see
[the image credits](./ASSETS.md). Product photos and videos, profile images,
and stories are member-uploaded rather than fabricated. Listing uploads use
short-lived S3 pre-signed PUT URLs, with multiple photos and at most one
product video (up to 60 seconds), capped at 10 media files per listing.

The Discover page displays listing photos and videos. Community members can
follow one another, and signed-in members have a live studio with camera and
microphone selection, mute controls, viewer count, and live chat.

Install dependencies and build the site with an explicit API base URL:

```sh
cd website
npm ci
VITE_DEPLOYMENT_STAGE=dev VITE_API_BASE_URL=https://4mvo7623gl.execute-api.af-south-1.amazonaws.com/dev npm run build
```

`VITE_API_BASE_URL` is required for production builds. For a production
deployment, also set `VITE_DEPLOYMENT_STAGE=prod`; the build rejects a missing,
non-HTTPS, or `/dev` API URL. The approved production website API target is the
API Gateway `Stage` endpoint:

```sh
VITE_DEPLOYMENT_STAGE=prod \
VITE_API_BASE_URL=https://4mvo7623gl.execute-api.af-south-1.amazonaws.com/Stage \
npm run build
```

The `Stage` API is part of the existing Lambda/DynamoDB deployment. Keep its
CORS allowlist synchronized with both the dev and production CloudFront origins.
The ECS/PostgreSQL API is not ready for client cutover. Never place secrets or
private credentials in public website config. Static AWS hosting is configured
separately from the marketplace API. Upload `dist/` to the private production
website bucket only after verifying the build target and API CORS configuration.

Anyone can browse listings and watch live streams without signing in. Any signed-in Dobha member, including buyers and sellers, can host a live stream after granting browser camera and microphone access. Sellers retain seller-only product pinning and listing controls.

Production checkout, wallet deposits/withdrawals, vouchers, cash on delivery,
refunds, seller payouts, and paid listing promotion are unavailable. If the
backend dev stage explicitly enables them, buyers can place sandbox test orders
using PayFast hosted sandbox checkout or an Escrow.com sandbox transaction.
Seller acceptance is required. Escrow status is refreshed server-side; the
website does not release funds. Preparation, courier/pickup progress, seller
handoff reports, and buyer confirmation are manual test statuses, not proof of
delivery or payout. Do not treat historical records or sandbox statuses as
evidence of real payment, delivery, refund, or payout. See
[the backend status](../server/README.md) for provider setup and release details.

The wallet page includes an interactive visual-only deposit preview for
proposed Yoco card checkout and 1Voucher methods. Its controls only display a
status message; they do not collect payment details, call a provider, or change
wallet balances. Provider logos are served by Logo.dev using the public
publishable key in `public/config.js`; restrict that key to Dobha's website
domains in the Logo.dev dashboard.

Buyers can send a direct purchase request from a listing without opening a chat
first. That request is delivered to the seller as a message; it is not an order,
item reservation, or payment. Sandbox checkout from the bag is a separate,
dev-only test flow.

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

Install dependencies and build the deployable site with:

```sh
cd website
npm ci
npm run build
```

Upload the contents of `dist/` to the private website bucket. The public runtime settings are in `public/config.js`; do not place secrets or private credentials there. Static AWS hosting is configured separately from the marketplace API. Until the AWS marketplace backend implements and passes parity testing, this website continues to call the current API configured there.

Anyone can browse listings and watch live streams without signing in. Any signed-in Dobha member, including buyers and sellers, can host a live stream after granting browser camera and microphone access. Sellers retain seller-only product pinning and listing controls.

Checkout, wallet deposits/withdrawals, order fulfillment, escrow settlement,
and paid listing promotion are unavailable. Do not treat historical order or
wallet records as evidence of a real payment, delivery, refund, or payout. The
website intentionally does not request payment or bank details. See
[the backend status](../server/README.md) for migration and release details.

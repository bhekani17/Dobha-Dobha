# Marketplace website

This directory contains the React/Vite website, built to static files for hosting from a private Amazon S3 bucket through CloudFront; see [the server deployment guide](../server/README.md). `src/legacy.html` is the single source of the existing marketplace markup, mounted by the React entry while its interactive features are progressively migrated to React components; it is not a second separately maintained website.

Install dependencies and build the deployable site with:

```sh
cd website
npm ci
npm run build
```

Upload the contents of `dist/` to the private website bucket. The public runtime settings are in `public/config.js`; do not place secrets or private credentials there. Static AWS hosting is configured separately from the marketplace API. Until the AWS marketplace backend implements and passes parity testing, this website continues to call the current API configured there.

Anyone can browse listings and watch live streams without signing in. Signing in is required for account actions such as saving items and selling.

Checkout, wallet deposits/withdrawals, order fulfillment, escrow settlement,
and paid listing promotion are unavailable. Do not treat historical order or
wallet records as evidence of a real payment, delivery, refund, or payout. The
website intentionally does not request payment or bank details. See
[the backend status](../server/README.md) for migration and release details.

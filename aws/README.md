# Dobha-Dobha AWS-hosted marketplace website

The website provides a general marketplace for clothing, electronics, home goods, books, sports gear, collectibles, and more. It shares accounts and marketplace data with the Flutter app through the existing Cloudflare Worker API. The website can watch mobile-hosted live streams but cannot publish or host a stream.

## Architecture

- **Amazon S3 + Amazon CloudFront** serve the website as a static site.
- **Cloudflare Workers, D1, R2, and LiveKit** remain the shared API, marketplace database/media store, and live-stream service used by the mobile app. The website sends the same bearer-token API requests as the app.
- The browser API endpoint and Google web OAuth client are configured in `web/config.js`.
- The Worker only allows website origins explicitly listed in `ALLOWED_WEB_ORIGINS`; wildcard origins are not accepted. Configure the final CloudFront hostname (and any custom domain) as a comma-separated list in `server/wrangler.jsonc`, then deploy the Worker. For local development, add the exact local origin temporarily and remove it before production.
- `template.yaml` also contains an AWS API/Cognito/DynamoDB learning prototype. The website does **not** call that API, and it does not share data with the mobile app. Do not treat that prototype as the website's active backend.

## Website functionality

- Separate Home, Shop, Live, Sell, Orders, Cart, Saved, Offers, Wallet, Messages, Notifications, Account, People, Support, Seller Profile, and About pages.
- Shared Cloudflare email/password and Google authentication, account registration, password reset, profile updates, avatar upload, password change, and account deletion.
- Browse/search/category-filter listings; view images and videos; like, save, comment on, report, add listings to cart, and make offers.
- Seller profile setup, listing upload and management, profile/follow discovery, and seller-to-buyer messaging.
- Cart checkout, order dispatch/confirmation/dispute, reviews, offers, simulated wallet actions, notifications, and support requests.
- Viewer-only LiveKit tokens. The website never issues host/publish tokens.
- App-matched theme, logos, and typography.

## Deploy the website

Requirements: AWS CLI configured for S3 and CloudFront, AWS SAM CLI, Node.js 22, and npm. Deploy the updated shared Cloudflare Worker from `server/` first so the expanded categories, public catalog reads, CORS allowlist, and current legal pages are available. Ensure its D1/R2 bindings and LiveKit configuration are already set up.

```bash
cd aws
npm install
npm test
sam validate --template-file template.yaml
sam build --template-file template.yaml
sam deploy --guided --template-file template.yaml --stack-name dobha-marketplace-dev
```

Set `web/config.js`'s `apiBase` to the shared Worker URL and `googleClientId` to the configured Google web client ID before uploading. Do not place private credentials in this file. After CloudFront creates a distribution, add its exact `https://...cloudfront.net` origin to the Worker `ALLOWED_WEB_ORIGINS` list and deploy the Worker; add any custom website domain too. Leave the allowlist empty until the intended origins are known. Do not set it to `*`.

Upload the static site to the private website bucket and invalidate CloudFront after each web release:

```bash
aws s3 sync web/ s3://<WebBucket> --delete
aws cloudfront create-invalidation --distribution-id <CloudFrontDistributionId> --paths '/*'
```

## Limitations and proof of work

- The shared app backend simulates payment and wallet transactions. Do not enter real payment details or describe these flows as real payment processing or production escrow.
- Password reset requires the Cloudflare Worker email binding to be configured. The API reports an explicit error when it is unavailable.
- Live viewing requires valid LiveKit Cloud configuration and a mobile host actively publishing.
- AWS deployment does not establish AWS Educate course completion, LinkedIn/Drive certificate evidence, or a sustained and authentic commit history. Those are separate proof-of-work requirements.
- The SAM API prototype is an additional, separate stack and can incur AWS charges; it is not required for the website's marketplace API. Review AWS billing and remove resources when no longer needed.

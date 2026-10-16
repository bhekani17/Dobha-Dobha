# Dobha-Dobha

Dobha-Dobha is a buy-and-sell marketplace with a Flutter mobile app and a static website.

## Project structure

```text
server/   Backend services, AWS infrastructure, and backend tests
mobile/   Flutter application
website/  Static marketplace website
```

- [server/](./server/) contains the current marketplace API, AWS infrastructure, an incomplete AWS marketplace API prototype, and the separate self-storage elective capstone.
- [mobile/](./mobile/) contains the Flutter application.
- [website/](./website/) contains the marketplace website hosted as static assets.

## AWS branch direction

The `aws` branch targets AWS services for the marketplace. The AWS backend now
includes transactional order/wallet handling and verified Cognito administrator
authorization. See [the migration tracker](server/marketplace-prototype/MIGRATION.md)
for implemented features and the remaining release gates.

## AWS migration status

The website's static hosting is configured for Amazon S3 and CloudFront in [server/infrastructure/website.yaml](./server/infrastructure/website.yaml). The marketplace API and mobile app have **not** completed their AWS migration: they still use the existing Cloudflare Worker in `server/`. The AWS marketplace API in [server/marketplace-prototype/](./server/marketplace-prototype/) is incomplete and is not a drop-in replacement.

Keep the current API running until AWS feature parity, data and media migration, and web/mobile cutover have been implemented and verified. Do not point the clients at the prototype or remove the current backend yet.

For server and AWS deployment instructions, see [server/README.md](./server/README.md). The Flutter application has its own setup instructions in `mobile/`.

## Proof of work

This repository does not substitute for AWS Educate course certificates, required LinkedIn/Drive evidence, a verified AWS deployment, or a steady and authentic commit history. Submit only work and evidence that are your own.

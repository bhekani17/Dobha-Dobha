# Dobha Dobha

Dobha Dobha is a general buy-and-sell marketplace. Sellers publish listings and may host live streams from the mobile app; website visitors can browse, buy/request items, and watch active streams, but cannot start a live stream from the website.

## AWS website branch

The `aws` branch contains the AWS-hosted marketplace website and Flutter mobile app. The website calls the same Cloudflare Worker API as the mobile app so accounts, listings, orders, and marketplace activity are shared. See [aws/README.md](./aws/README.md) for architecture, deployment, configuration, and limitations.

## Existing application

The Flutter app remains in `mobile/`, its shared API is in `server/`, and its Firebase distribution workflow is in `.github/workflows/`. The AWS SAM API under `aws/` is a separate learning prototype and is not the source of website marketplace data.

## Proof-of-work note

Code in this repository does not replace AWS Educate course certificates, required LinkedIn/Drive evidence, an actual AWS deployment, or a steady and authentic commit history. Do not submit course completion or deployment claims until they are true and verifiable.

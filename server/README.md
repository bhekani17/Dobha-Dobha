# Marketplace backend and migration status

## Repository layout

```text
server/
  src/                       Existing Lambda/DynamoDB-oriented backend handlers
  test/                      Tests for the existing backend source
  infrastructure/
    template.yaml            Legacy SAM/Lambda/DynamoDB stack
    template-rds.yaml        Legacy, incomplete Lambda/RDS alternative
    website.yaml             Private S3 + CloudFront website hosting
  ecs-api/                   Separate Fastify/PostgreSQL target foundation
```

The mobile client is in `../mobile/`; the React/Vite website is in
`../website/`. The website currently mounts its existing marketplace markup
through a React bridge while its interactions are migrated incrementally; keep
that markup as a single source rather than maintaining duplicate mobile/web
implementations.

## Current source versus target

`src/` and `infrastructure/template.yaml` are the existing Lambda/DynamoDB
implementation. The `template-rds.yaml` alternative is not the chosen
architecture and is not production-ready; it lacks the target ECS/RDS Proxy
design. Neither template represents the planned production architecture.
Check the deployed AWS account and runtime directly before release decisions;
repository contents alone do not establish what is currently live.

`ecs-api/` is the selected migration direction from the earlier architecture
decision: Node.js/Fastify, PostgreSQL/Prisma, and ECS Fargate. It currently
contains a process/health foundation, relational schema, initial migration,
and an escrow service. It does not yet contain production authentication,
marketplace routes, provider webhooks, ECS infrastructure, or client parity.
No existing client is cut over to it.

## Financial safety status

The current source rejects checkout/order creation, shipment dispatch,
confirmation, escrow resolution, wallet deposits/withdrawals, and paid listing
promotion until verified payment processing exists. The clients no longer
offer payment entry or claim that demo records represent held funds. Historical
order and wallet data can still exist; those records do not prove that a real
payment, delivery, refund, or payout occurred.

These are source-level protections, not a production incident fix. The build
pipeline is validation-only and does not deploy them. Verify the live runtime,
perform a reviewed staged release, and test the deployed endpoints before
claiming that any production environment has these protections.

## Development and checks

Existing backend tests:

```sh
cd server
npm ci
npm test
```

No demo seed script is included. Keep shared development data free of sample
accounts, listings, and balances; use isolated test fixtures instead.

The ECS API foundation and its escrow service tests are documented in
[ecs-api/README.md](./ecs-api/README.md). It needs Node.js 22 and a generated
Prisma client. Both backend projects now have committed npm lockfiles and the
CI build uses `npm ci`; resolve the Prisma advisory documented in the ECS API
guide before production use.

The root `buildspec.yml` runs tests, JavaScript syntax checks, the website
production bundle, SAM validation, and SAM build only. It does not create
buckets, delete stacks, or deploy AWS resources. Treat both SAM templates as
legacy artifacts and do not promote them as the target service. The
`deploy:aws` package script was removed so it cannot accidentally deploy the
legacy Lambda/DynamoDB template. There is no approved API deployment command
until the ECS target and its reviewed infrastructure are production-ready.

## Infrastructure

`infrastructure/website.yaml` provisions a private encrypted S3 bucket and
CloudFront Origin Access Control. It hosts static website assets only; it does
not migrate or deploy an API.

Before implementing ECS infrastructure or a client cutover, define and review:

- Private VPC subnets, ALB/task security groups, ECS Fargate service/task roles,
  and RDS Proxy connectivity.
- Secrets Manager integration, TLS, least-privilege IAM, and private media
  access.
- Media upload uses short-lived S3 URLs for larger files, and media reads
  redirect to short-lived S3 URLs so browsers can stream videos without
  buffering them through Lambda.
- CloudWatch logs, metrics, alarms, audit events, and operational runbooks.
- Database/media migration, backups, rollback, route parity, and load tests.
- Verified payment-provider webhooks, idempotent ledger operations, disputes,
  reconciliation, and end-to-end financial tests.

Do not direct production clients or migrate production data until those
controls and parity tests are implemented and a cutover has been approved.

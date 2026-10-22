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

Online payments are not enabled. Buyers can send a direct purchase request to a
seller and arrange the transaction outside Dobha. After the handoff, both
parties can report completion in chat, which marks the listing sold; these
reports do not verify payment and are not orders or escrow records. The existing
Lambda handlers reject order creation,
dispatch, confirmation, escrow resolution, wallet deposits and withdrawals,
and paid listing promotion with HTTP 503 responses before accessing
persistence. The ECS API has no payment-provider integration. Do not treat
historical order, wallet, or transaction records as evidence of real payment,
delivery, refund, or payout.

The build pipeline is validation-only and does not deploy changes. Verify the live runtime, perform a reviewed staged release, and test the deployed endpoints before claiming that any production environment has these features.

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
Prisma client. Both backend projects use committed npm lockfiles and CI uses
`npm ci`. The ECS API now uses Prisma 7.10.1 to resolve the reported dependency
advisory; its generation and regression tests remain required before production
use.

The root `buildspec.yml` runs tests, JavaScript syntax checks, the website
production bundle, SAM validation, and SAM build only. It does not create
buckets, delete stacks, or deploy AWS resources. Treat both SAM templates as
legacy artifacts and do not promote them as the target service. The
`deploy:aws` package script was removed so it cannot accidentally deploy the
legacy Lambda/DynamoDB template. General API feature deployments remain gated
on the ECS target and its reviewed infrastructure; the CORS-only update for the
approved `Stage` API was a narrowly scoped exception and does not represent an
API migration or enable payment features.

## Infrastructure

`infrastructure/website.yaml` provisions a private encrypted S3 bucket and
CloudFront Origin Access Control. It hosts static website assets only; it does
not migrate or deploy an API.

The API `AllowedOrigin` parameter accepts comma-separated trusted website
origins. Lambda responses echo only a request origin from this allowlist;
static API Gateway preflight and gateway-error responses use wildcard CORS
headers because those responses cannot dynamically echo the request origin.
Do not treat CORS as API authorization.

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

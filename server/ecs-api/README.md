# ECS API foundation

This directory is a new PostgreSQL/Fastify API foundation for the planned ECS
Fargate architecture. It is intentionally separate from `server/src/` and
`server/marketplace-prototype/`: those backends have existing runtime and client
contracts and must not be replaced until the migration and parity checks are
complete. This scaffold does not duplicate their routes or include seed data.

## Repository layout recommendation

Keep a single repository while the three clients and API evolve together. A
monorepo makes API contracts, authentication changes, and mobile/web cutovers
reviewable as one change. For now, do not move existing projects; use this
transitional layout:

```text
Dobha-Dobha/
  mobile/                     Existing Flutter app
  website/                    React/Vite site with a compatibility bridge for
                              existing marketplace markup and interactions
  server/
    src/                      Existing backend; preserve during migration
    marketplace-prototype/    Existing AWS prototype; preserve during migration
    ecs-api/                  New PostgreSQL + ECS API
  infrastructure/             Future shared Terraform root
```

After the API/client migration is approved, the desired monorepo shape is:

```text
apps/
  web/                        React + TypeScript
  mobile/                     Flutter
  api/                        Node.js + Fastify
packages/
  api-contracts/               OpenAPI schema and generated client contracts
infra/
  terraform/                   Network, data, compute, edge, and observability
```

Do not keep both the old and new web apps as production sources once the React
cutover is complete. Keep infrastructure definitions separate from application
packages, and share API specifications rather than copying business logic
between clients.

## API module layout

```text
server/ecs-api/
  prisma/
    schema.prisma
  src/
    app.js                     Fastify app and health/readiness routes
    server.js                  Process startup and graceful shutdown
    config.js                  Environment validation
    db/
      prisma.js                PostgreSQL pool and Prisma adapter
    modules/
      auth/                    Cognito/JWT verification and authorization
      products/                Listings, reels, media upload authorization
      live-streams/            LiveKit/Agora session orchestration
      orders/                  Order lifecycle and inventory reservation
      escrow/
        escrow.service.js      Atomic wallet/escrow state transitions
  test/
```

The first increment implements the API process, database connection, schema,
and escrow domain service. Module directories that do not yet have behavior are
deliberately only part of the target layout above; no placeholder handlers are
added.

The ECS API test suite covers configuration validation, liveness/readiness
responses, and escrow idempotency and transaction boundaries. Run it after
installing dependencies and generating the Prisma client:

```sh
npm ci
npm run prisma:generate
npm test
```

## Database and escrow rules

- PostgreSQL is the source of truth. Store money as integer minor units (ZAR
  cents), never floating-point values. Keep currency on every wallet/order.
- A user can have multiple roles. Vendor-only fields live in `VendorProfile`.
- Listing/reel media fields hold object keys, not public S3 URLs. Issue
  short-lived upload/download URLs from a separately authorized media endpoint.
- An order snapshots the buyer, seller, listing, amount, and currency so later
  listing edits cannot change the transaction.
- Wallet balances are transactionally updated projections; append-only ledger
  entries record each movement. The initial migration blocks ledger updates and
  deletes with a database trigger, and enforces non-negative wallet balances
  plus positive listing/order/escrow amounts with database `CHECK` constraints.
- `fundOrder` derives the amount and parties from the persisted order and
  atomically moves the buyer's available wallet amount into held funds. It does
  not accept payment confirmation from a client. A verified payment-provider
  webhook or a completed wallet deposit must credit available funds first.
- Payout/refund/dispute resolution uses explicit state transitions, a unique
  idempotency key, conditional balance updates, and PostgreSQL serializable
  transactions. Serialization conflicts (`P2034`) are retried up to three times
  with the same key, and a committed idempotent result is recovered if another
  concurrent request wins. Never retry with a new key.
- Route-level authentication/authorization, payment webhooks, order creation,
  and the provider-specific live-stream integration are subsequent increments;
  do not expose this service directly before those controls exist.

## Local setup

Use Node.js 22 and provide `DATABASE_URL`. In production, also provide
`DATABASE_CA_CERT_PATH` pointing to the trusted RDS CA bundle. Inject the
database URL from AWS Secrets Manager; do not commit credentials or a populated
environment file.

```sh
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

`/healthz` is process liveness. `/readyz` checks PostgreSQL. The PostgreSQL
pool connects through the RDS Proxy endpoint. Set `DB_POOL_MAX` based on the
maximum ECS task count and the proxy/database connection budget; the default is
5 per task. Keep transactions short so the proxy can multiplex connections.
Enable TLS certificate verification in production using the RDS CA bundle.

## Deployment direction

Build from this directory so credentials and unrelated project files are not
part of the Docker build context:

```sh
docker build --target runtime -t dobha-ecs-api:local .
docker build --target migration -t dobha-ecs-api:migrate .
```

The `runtime` target is non-root and contains production dependencies only. The
`migration` target is intended for a one-off ECS release task using the same
image revision and database secret as the service; it runs
`prisma migrate deploy` and must finish successfully before the service
deployment proceeds. It deliberately refuses to run when no Prisma migration
has been committed. Committed npm lockfiles are used for repeatable dependency
installation.

The current Prisma 6 dependency tree reports a high-severity `deepmerge-ts`
advisory through the Prisma configuration tooling; npm reports that its
available fix requires a Prisma major upgrade. Treat resolution and regression
testing of that upgrade as a release gate before exposing this target service.

Deploy an immutable runtime image to an ECS Fargate service in private subnets
behind an internet-facing ALB. Terminate public TLS at the ALB, restrict task
ingress to the ALB security group, and use separate security groups for the RDS
Proxy and database. Store secrets in Secrets Manager and grant task roles only
the required secret, S3, and media-provider permissions. Use an ALB health
check against `/readyz`, autoscale on CPU/request load, and send structured logs
and metrics to CloudWatch. Put CloudFront/WAF in front of the React static
site; add API WAF rules at the ALB/CloudFront edge as the chosen API topology
supports. Never run migrations independently from every API task.

Before production cutover, add automated API parity tests, payment-provider
webhook verification, rate limits, audit logging, backup/restore checks,
disaster-recovery objectives, and tested client rollback procedures.

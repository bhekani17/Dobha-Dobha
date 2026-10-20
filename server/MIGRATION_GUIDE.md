# Marketplace migration guide

## Decision and current state

The selected target is Node.js/Fastify on ECS Fargate, PostgreSQL through RDS
Proxy, and Prisma. Keep the existing Lambda/DynamoDB code and client APIs
available during migration; this repository does not yet implement a complete
replacement or a production cutover.

Current components:

- `server/src/`: existing Lambda/DynamoDB-oriented marketplace handlers.
- `server/infrastructure/template.yaml`: legacy SAM stack; not the target.
- `server/infrastructure/template-rds.yaml`: incomplete legacy Lambda/RDS
  alternative; not the target.
- `server/ecs-api/`: separate Fastify/PostgreSQL schema, health endpoints, and
  escrow service foundation, without production auth or marketplace routes.
- `website/`: React/Vite static site. Existing marketplace markup and
  interactions are mounted through a compatibility bridge pending incremental
  component migration.
- `mobile/`: Flutter application.

Verify the deployed account/runtime separately. A source change or this plan
does not update a running service.

## Financial release gate

Payments are not real or simulated in this release. Current source blocks
checkout, order funding, fulfillment, escrow settlement, wallet deposits and
withdrawals, and paid listing promotion. Historical wallet/order states are
not proof of funds, payment, delivery, refund, or payout. Do not enable these
flows until the provider, signed webhook verification, idempotency,
reconciliation, immutable ledger, authorization, and operational support
process have been implemented and tested.

The current root `buildspec.yml` is CI-only: tests, syntax checks, the website
production bundle, SAM validation, and a local SAM build. It performs no AWS
deployment. Do not reintroduce automatic deployment of either legacy SAM
template.

## Recommended migration sequence

1. Complete ECS authentication, authorization, user/product/live/order routes,
   API contracts, rate limiting, audit logging, and provider integration.
2. Build immutable images from the committed dependency lockfiles, then
   implement Terraform or CDK for private VPC tasks, ALB, ECS Fargate, RDS
   Multi-AZ, RDS Proxy, S3, CloudFront/WAF, Secrets Manager, and CloudWatch.
3. Add isolated database and financial workflow tests, concurrency tests,
   provider webhook replay/signature tests, backup/restore checks, and alarms.
4. Build route-level parity tests for both clients. Migrate and verify identity,
   data, and media with backup and rollback procedures.
5. Deploy to a non-production environment, test operational behavior, and
   complete a reviewed staged client cutover with a rollback path.
6. Remove legacy infrastructure only after the cutover and retention
   obligations are confirmed.

Never point a production client at `server/ecs-api/` until each required route,
authentication path, database migration, and payment behavior passes its
release gate.

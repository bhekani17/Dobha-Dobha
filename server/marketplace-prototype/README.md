# AWS marketplace backend

The `aws` branch targets AWS for its marketplace backend: API Gateway, Lambda,
Cognito, DynamoDB, S3, CloudFront and SQS. This directory retains its historical
`marketplace-prototype` name. It is migration work; existing clients still depend
on routes and authentication flows that have not yet been migrated.

## Local verification

Use Node.js 22 and npm with the committed lockfile:

```bash
npm ci --ignore-scripts
npm test
sam validate --lint --region af-south-1 --template-file template.yaml
AWS_DEFAULT_REGION=af-south-1 AWS_EC2_METADATA_DISABLED=true python tool/verify_template.py
sam build --template-file template.yaml
```

Install `aws-sam-cli==1.155.2` in a Python virtual environment to run the same
SAM translator used in CI. The offline template check asserts authorization on
the generated API methods, including public reads and protected listing writes.

Tests mock AWS clients and require no AWS credentials. SAM builds require the
SAM CLI and Node.js. No repository-wide install command is needed: each server
project has its own npm manifest. See [migration status](MIGRATION.md) before
changing client endpoints.

## Identity and administrator access

Cognito confirms email ownership before password sign-in. Registration does not
assign administrator privileges. An operator must explicitly add a confirmed
user to this stack's `administrators` Cognito group. Admin operations require
both that group and the signed Cognito claim `email_verified=true`; a matching
email address or a profile field never grants access. Group changes take effect
when a new ID token is issued.

Use `POST /api/auth/register`, then `/api/auth/confirm` with the emailed code,
then `/api/auth/login`. Clients must retain the returned refresh token privately
and exchange it at `/api/auth/refresh` when the ID token expires. The legacy
opaque Cloudflare tokens cannot authenticate against Cognito. Existing accounts
need an explicit migration and password-reset plan.

## Orders and simulated payments

Order/wallet logic lives in `src/orders.js`. Checkout commits the stock claim,
order snapshot, wallet changes, ledger entry and notification outbox in one
DynamoDB transaction. Stock updates compare the exact previously read quantity
and price, preventing concurrent buyers from overwriting each other's claims.

Dispatch, dispute, confirmation and administrator settlement use conditional
transactions. Confirmation and settlement commit the terminal status and wallet
entries together. Retrying an already completed matching settlement returns the
order without issuing another payout. Insufficient balances and concurrent
changes reject the whole transaction; no compensating balance writes are used.

Implemented order routes:

- `GET/POST /api/orders`
- `POST /api/orders/{id}/dispatch`
- `POST /api/orders/{id}/confirm`
- `POST /api/orders/{id}/dispute`
- `POST /api/orders/{id}/resolve` (verified administrators)
- `GET /api/wallet`
- `POST /api/wallet/topup` and `/api/wallet/withdraw` (development only)

**No real money is collected, held, refunded or paid out.**
`EnableSimulatedPayments` defaults to `false`. Enable it explicitly only for a
synthetic development environment. Real payment methods need a provider,
verified and idempotent webhooks, reconciliation and payout handling before use.
Wallet payments require an existing sufficient balance. Account deletion checks
available, locked and pending balances and atomically locks a zero-balance
account against concurrent checkout/top-up activity before removing personal
data. Settled order addresses are removed when their buyer deletes the account.

## Infrastructure and deployment

The stack provides private S3 buckets and CloudFront access control. CloudFront
forwards `/api/*` requests to API Gateway with API caching disabled. Personal API
responses also use `Cache-Control: no-store`. The website gets security headers;
API Gateway applies request throttles. DynamoDB point-in-time recovery and
resource retention are enabled; database and media resources survive stack
deletion/replacement. A retention policy is not a tested backup/restore process.

Use the CloudFront origin for same-origin web API calls. `AllowedOrigin` is an
optional exact external browser origin; it defaults to empty, not a wildcard.
Direct cross-origin clients also need explicit OPTIONS routing before use.

The CodeBuild pipeline tests and builds by default. Deployment requires explicit
`DEPLOY_AWS=true` in its environment and a `SAM_BUCKET` belonging to the intended
account. It does not delete rollback stacks or upload website assets. Review the
account, region and stack name, then deploy only to an authorized environment:

```bash
sam deploy --guided --template-file template.yaml
```

The stack can create billable resources. A deployed smoke test, backup/restore
exercise, monitoring and alarm configuration, and a rollback drill remain
release gates. Live video selection and client feature parity are tracked in
[MIGRATION.md](MIGRATION.md).

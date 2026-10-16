# Self-storage AWS capstone

An independent, small self-storage reservation application aligned with the Cloud Computing elective capstone brief. It is not the Dobha marketplace and does not use the marketplace's Cloudflare API, database, or media.

## Architecture

```text
Browser
  ├─ Amazon Cognito user pool (email registration, verification, sign-in)
  └─ Amazon CloudFront
       ├─ private Amazon S3 bucket (static web application)
       └─ /api/* → Amazon API Gateway → authenticated AWS Lambda API
                                         ├─ Amazon DynamoDB (units and reservations)
                                         └─ DynamoDB outbox stream → relay Lambda
                                                                     → Amazon SQS
                                                                        → worker Lambda
                                                                           → notifications in DynamoDB
```

The API only accepts Cognito-authenticated requests. It takes the user's subject from verified authorizer claims and scopes reservations and notifications to that user's DynamoDB partition. Reservation and unit state changes use DynamoDB transactions, so concurrent requests cannot reserve the same available unit. Outbox records are committed in the same transaction; DynamoDB Streams sends them to SQS, and the idempotent queue worker persists notifications.

The first version provides:

- Cognito email sign-up, email confirmation, and password sign-in.
- Authenticated storage-unit discovery and reservation listing.
- Atomic reserve and release operations; a reservation cannot be released by another user.
- Administrator-only unit creation, controlled by the stack's `AdminEmails` parameter. The default is empty, which disables unit creation.
- Asynchronous, in-app reservation notifications delivered through DynamoDB Streams and SQS.
- Private S3 website hosting through CloudFront Origin Access Control. `/api/*` is forwarded to API Gateway without caching or forwarding cookies.

## Layout

- `template.yaml` — SAM/CloudFormation resources and IAM policies.
- `src/api.js` — API routes, Cognito-claim access control, and atomic reservation logic.
- `src/notification_relay.js` — forwards committed DynamoDB outbox events to SQS.
- `src/notification_worker.js` — idempotently stores queued notifications.
- `web/` — static browser client.
- `test/` — focused API validation tests.

## Prerequisites and deploy

Use an AWS account you are authorized to use, AWS CLI credentials for the intended account, AWS SAM CLI, Node.js 22, and npm. Choose a region close to your users. Review the AWS Free Tier/current pricing and set a budget alert before deployment. This stack provisions billable AWS resources; deleting a stack does not guarantee that every charge stops immediately.

From the repository root:

```powershell
Push-Location .\server\capstone-self-storage
npm ci
npm test
sam validate --lint --template-file .\template.yaml
sam build --template-file .\template.yaml
sam deploy --guided --template-file .\template.yaml --stack-name dobha-self-storage-dev
Pop-Location
```

The guided SAM deploy creates the development stack. To add units, pass a verified administrator email when deploying or updating the stack from this directory:

```powershell
sam deploy --template-file .\template.yaml --stack-name dobha-self-storage-dev --parameter-overrides Stage=dev AdminEmails=you@example.com
```

For multiple administrators, use a comma-separated `AdminEmails` value. Keep deployment configuration appropriate to the project and do not add AWS credentials or account secrets to source control.

## Configure and publish the browser app

After deployment, get the public configuration values and output names:

```powershell
aws cloudformation describe-stacks --stack-name dobha-self-storage-dev --query "Stacks[0].Outputs" --output table
```

Copy `UserPoolId`, `UserPoolClientId`, and the deployment region to `web\config.js`. These Cognito identifiers are public client configuration, not credentials. Leave `apiBase` set to `/api`; the CloudFront behavior forwards that same-origin path to API Gateway.

Upload the client and invalidate cached files:

```powershell
aws s3 sync .\web\ s3://<WebsiteBucket> --delete
aws cloudfront create-invalidation --distribution-id <CloudFrontDistributionId> --paths "/*"
```

Open `WebsiteUrl`, register an account, and confirm the email. To list units, sign in with an email included in `AdminEmails` and add a unit. A normal account can reserve and release available units.

## API routes

All routes require an `Authorization` header containing the Cognito ID token.

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/units` | List up to 100 units |
| `POST` | `/api/units` | Add a unit (configured administrator only) |
| `GET` | `/api/reservations` | List the signed-in user's reservations |
| `POST` | `/api/reservations` | Reserve an available unit using `{ "unitId": "..." }` |
| `DELETE` | `/api/reservations/{reservationId}` | Release the signed-in user's active reservation |
| `GET` | `/api/notifications` | List the signed-in user's recent notifications |

## Current boundaries

- This is a capstone starter, not a production storage business. It does not process payments, issue facility access credentials, or provide physical storage.
- Notifications are persisted in-app only; no email or SMS provider is configured.
- Admin emails are a simple project-level control. Production administration should use a managed Cognito group/role with explicit least-privilege authorization.
- Reservation billing is represented as an estimated monthly unit price; no billing cycle, renewal, tax, or payment is implemented.
- The web app keeps its ID token in memory and does not persist it to browser storage. Signing out or reloading clears the session.
- DynamoDB queries are deliberately capped at 100 units/reservations and 50 notifications; pagination is a future improvement.
- There is no custom domain, WAF, multi-AZ application tier, or recovery plan in this initial learning version. Assess those against the final demo and budget.

The elective proof form separately requires your own completion-certificate evidence and LinkedIn post links. This repository/code does not create or substitute that proof. Keep making authentic, incremental commits and submit only your own work.

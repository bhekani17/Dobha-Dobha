# Dobha server and AWS deployment

`server/` contains the backend and infrastructure for the applications in the repository:

```text
server/
  src/                       Current marketplace API
  migrations/                Current marketplace database migrations
  infrastructure/            AWS static website hosting template
  marketplace-prototype/     Incomplete AWS marketplace API prototype
  capstone-self-storage/      Separate AWS elective capstone
```

## Current marketplace status

The active marketplace API is still the service in `src/`, deployed using its current Worker configuration. The website and mobile app depend on it today. The AWS marketplace API in `marketplace-prototype/` supports only a subset of the current route and data contract, so it is not ready to replace the active backend.

The website's static assets can be hosted in a private Amazon S3 bucket behind CloudFront. That does not, by itself, migrate the API: the website configuration currently still points to the existing API. Keep that service available until the AWS API, data/media migration, and both client cutovers have passed parity testing.

The Flutter app can be built against a future AWS CloudFront/API origin without changing its production default:

```powershell
Push-Location .\mobile
flutter build web --release --dart-define-from-file=config/google.json --dart-define=API_BASE_URL=https://<CloudFront-domain>
Pop-Location
```

For Android/iOS builds, pass the same `--dart-define=API_BASE_URL=...` option along with the Google sign-in configuration. Leave `API_BASE_URL` unset until the AWS API implements and passes parity tests; otherwise the app continues to use the current API (or the current web origin).

## Deploy static website hosting to AWS

Requirements: AWS CLI configured for the intended account and region, Node.js/npm only if needed for local website tooling, and permissions to manage CloudFormation, S3, and CloudFront. Provision the private bucket and CloudFront distribution:

```powershell
aws cloudformation validate-template --template-body file://server/infrastructure/website.yaml
aws cloudformation deploy --template-file server/infrastructure/website.yaml --stack-name dobha-website-dev --parameter-overrides Stage=dev
aws cloudformation describe-stacks --stack-name dobha-website-dev --query "Stacks[0].Outputs" --output table
```

Upload the static site from the repository root using the `WebsiteBucketName` output:

```powershell
aws s3 sync .\website\ s3://<WebsiteBucketName> --delete
aws cloudfront create-invalidation --distribution-id <WebsiteDistributionId> --paths "/*"
```

The website uses the public browser configuration in `website/config.js`. It contains a Google OAuth client ID and the current API URL; never place private credentials or AWS secrets there. The current API still requires the website origin to be allowlisted by the active service.

## AWS marketplace API prototype

`marketplace-prototype/` contains a separate SAM/Cognito/DynamoDB implementation for evaluating the AWS migration. It does not share data with the current marketplace service, and it does not yet implement all current marketplace functionality.

The prototype's `DELETE /api/me` requires a fresh password check (or a typed `DELETE` confirmation for passwordless accounts), refuses unsettled or unknown order statuses, removes personal buyer delivery addresses, deletes unsold listings and personal media, and anonymizes the profile while retaining settled order history and sold listings. The prototype does not yet implement wallet balances; add and test the equivalent available/locked/pending balance safeguard before migrating wallet data or treating account deletion as production-ready.

```powershell
Push-Location .\server\marketplace-prototype
npm test
sam validate --template-file .\template.yaml
sam build --template-file .\template.yaml
Pop-Location
```

Only deploy this prototype to an AWS account you are authorized to use. It can create billable resources. Do not direct production clients or migrate production data to it until its features, authorization, storage, and operational behavior have been reviewed and tested.

### Deploying from CodePipeline

The repository-root `buildspec.yml` runs the marketplace prototype tests, validates and builds its SAM template, then deploys it to `af-south-1`. To use it, configure the CodePipeline build action as an AWS CodeBuild project using a managed Linux image that supports Node.js 22 and Python 3.11 and the source artifact's repository-root `buildspec.yml`; the current inline Commands action does not read this file. Configure the CodeBuild project and its service role in the AWS Console. The CodeBuild service role (not just the CodePipeline role) needs access to the SAM deployment artifact bucket, CloudFormation, the resources in `marketplace-prototype/template.yaml`, and `iam:PassRole` for the Lambda execution roles. Do not grant administrator permissions as a workaround. The first deployment may fail until the account's CloudFormation/SAM managed deployment resources and required permissions are set up.

The buildspec deploys automatically on every pipeline execution. Review the pipeline branch and AWS account/region before enabling it. The SAM template includes CloudFront and website S3 resources in addition to the API; this build does not upload website assets.

## Self-storage elective capstone

The independent [self-storage capstone](./capstone-self-storage/README.md) is not part of the marketplace. Its Cognito-authenticated SAM application uses API Gateway, Lambda, DynamoDB, S3/CloudFront, and SQS-backed notifications. Follow its README for prerequisites and deployment. Review AWS pricing and create a budget alert before provisioning resources.

## Marketplace migration requirements

Before switching the marketplace clients or removing the current API, complete and verify:

- Route and behavior parity for website and mobile features.
- Authentication/account migration and safe password-reset behavior.
- Database and media migration, with backup and rollback procedures.
- AWS least-privilege permissions, secrets management, origin restrictions, and monitoring.
- Web and mobile integration tests against the deployed AWS environment.
- A controlled client cutover and post-deployment checks.

Do not claim AWS-only marketplace hosting until the API and client cutover is complete.

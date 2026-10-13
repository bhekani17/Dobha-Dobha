# AWS marketplace API prototype

This is a partial AWS SAM implementation of the Dobha marketplace API. It is kept under `server/` as migration work, not as a production-ready replacement for the active backend.

## Layout

- `template.yaml` provisions the prototype's API Gateway, Cognito, DynamoDB, S3, SQS, and Lambda resources.
- `src/` contains API and notification handlers.
- `test/` contains focused Node.js tests for the implemented behavior.

## Test and validate

From this directory:

```powershell
npm test
sam validate --template-file .\template.yaml
sam build --template-file .\template.yaml
```

Deploying the template may incur AWS charges. Use only an AWS account you are authorized to use and review the stack resources before deployment.

## Not ready for client cutover

This API does not yet implement all marketplace routes or flows. The website and mobile app still rely on the active service in `server/`; its contract, account data, and media storage have not been migrated. Do not point production clients at this prototype or remove the active service until feature parity and end-to-end tests are verified.

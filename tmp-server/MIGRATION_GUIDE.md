# AWS Migration Guide for Dobha-Dobha

## Current Status

**Completed:**
- ✅ AWS architecture designed (Lambda, API Gateway, DynamoDB, Cognito, S3, CloudFront)
- ✅ SAM template created (`server/infrastructure/template.yaml`)
- ✅ Website hosting template created (`server/infrastructure/website.yaml`)
- ✅ AWS dependencies added to package.json
- ✅ Lambda wrapper created (`server/src/lambda-wrapper.js`)

**Remaining Work:**
- ⏳ Rewrite backend modules to use AWS services instead of Cloudflare
- ⏳ Deploy infrastructure to AWS
- ⏳ Migrate database from D1 to DynamoDB
- ⏳ Update frontend configurations
- ⏳ Test and verify

## Architecture Overview

### Current (Cloudflare)
- **Compute**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2
- **Real-time**: Cloudflare Durable Objects
- **Email**: Cloudflare Email Service

### Target (AWS)
- **Compute**: AWS Lambda
- **API**: API Gateway
- **Database**: Amazon DynamoDB
- **Storage**: Amazon S3
- **CDN**: CloudFront
- **Auth**: Amazon Cognito
- **Email**: Amazon SES
- **Queue**: Amazon SQS
- **Push**: Amazon SNS

## Module Migration Checklist

Each module in `server/src/` needs to be rewritten to use AWS services:

### 1. auth.js (Authentication)
**Current**: Uses D1 for users/sessions tables
**Migration to**:
- Cognito User Pool for user authentication
- DynamoDB for user profiles
- JWT tokens from Cognito
- Keep Google OAuth via Cognito identity provider

**Key changes needed**:
- Replace `env.DB.prepare()` with `env.DYNAMO.get()/put()/query()`
- Replace password hashing with Cognito's built-in auth
- Use Cognito Admin API for user management
- Update session handling to use Cognito tokens

### 2. items.js (Listings)
**Current**: Uses D1 for items/likes/saves/comments, R2 for photos
**Migration to**:
- DynamoDB for all item-related tables
- S3 for photo storage

**Key changes needed**:
- Replace SQL queries with DynamoDB operations
- Replace `env.PHOTOS.put()` with S3 SDK calls
- Update media serving to use S3 presigned URLs or CloudFront signed URLs

### 3. orders.js (Orders & Wallet)
**Current**: Uses D1 for orders/wallets/transactions
**Migration to**:
- DynamoDB for orders, wallets, transactions

**Key changes needed**:
- Replace SQL with DynamoDB operations
- Keep wallet logic the same, just change data access layer

### 4. social.js (Social features)
**Current**: Uses D1 for cart/offers/follows/messages/reviews
**Migration to**:
- DynamoDB for all social tables
- API Gateway WebSocket for real-time chat (optional, can keep polling)

**Key changes needed**:
- Replace SQL with DynamoDB operations
- Consider using DynamoDB Streams for real-time updates

### 5. notifications.js
**Current**: Uses D1 for notifications
**Migration to**:
- DynamoDB for notifications
- SNS for push notifications
- SQS for reliable delivery

**Key changes needed**:
- Replace SQL with DynamoDB operations
- Add SNS integration for mobile push
- Add SQS for queueing notifications

### 6. support.js
**Current**: Uses D1 for support requests
**Migration to**:
- DynamoDB for support requests
- SES for email replies

**Key changes needed**:
- Replace SQL with DynamoDB operations
- Replace `env.EMAIL` with SES SDK calls

### 7. push.js
**Current**: Uses Cloudflare push notifications
**Migration to**:
- SNS for push notifications
- SQS for queueing

**Key changes needed**:
- Replace Cloudflare push with SNS
- Use SQS for reliable delivery

### 8. live.js (Live streaming)
**Current**: Uses LiveKit with Durable Objects
**Migration to**:
- Keep LiveKit (external service)
- Lambda generates tokens
- Or migrate to AWS IVS

**Key changes needed**:
- Remove Durable Objects dependency
- Generate tokens from Lambda using secrets from Secrets Manager

### 9. google.js (Google OAuth)
**Current**: Validates Google ID tokens
**Migration to**:
- Cognito with Google identity provider
- Or keep custom validation with JWT library

**Key changes needed**:
- Either integrate with Cognito's Google provider
- Or keep current logic with proper JWT validation

### 10. account.js
**Current**: Uses D1 for password reset, account deletion
**Migration to**:
- Cognito for password reset
- DynamoDB for account data
- SES for emails

**Key changes needed**:
- Use Cognito's forgot password flow
- Use SES for sending emails
- Update account deletion to use DynamoDB

## Database Migration Strategy

### Step 1: Export Data from D1
```bash
# Export each table to JSON
wrangler d1 execute dobha --remote --command "SELECT * FROM users" --json > users.json
# Repeat for all tables
```

### Step 2: Transform to DynamoDB Format
Create a script to convert SQL results to DynamoDB items:
```javascript
// Transform users
{
  id: "user-123",
  email: "user@example.com",
  password_hash: "...",
  password_salt: "...",
  name: "John Doe",
  handle: "johndoe",
  phone: "+27...",
  role: "shopper",
  shop_name: "",
  stall_location: "",
  created_at: 1234567890
}
```

### Step 3: Import to DynamoDB
Use AWS Data Pipeline or batch write with DynamoDB SDK:
```javascript
for (const user of users) {
  await docClient.put({
    TableName: process.env.USERS_TABLE,
    Item: user
  });
}
```

### Step 4: Validate
- Compare record counts
- Sample data verification
- Test queries

## Deployment Steps

### 1. Prerequisites
- AWS CLI installed and configured
- AWS credentials with appropriate permissions
- Node.js 22+ installed
- SAM CLI installed

### 2. Deploy Infrastructure
```bash
cd server/infrastructure
sam validate --template-file template.yaml
sam build --template-file template.yaml
sam deploy --template-file .aws-sam/build/template.yaml \
  --stack-name dobha-marketplace-dev \
  --region af-south-1 \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --parameter-overrides Stage=dev AllowedOrigin='*'
```

### 3. Deploy Website
```bash
cd server/infrastructure
aws cloudformation deploy \
  --template-file website.yaml \
  --stack-name dobha-website-dev \
  --parameter-overrides Stage=dev

# Upload website assets
aws s3 sync ../website s3://dev-dobha-website --delete
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/*"
```

### 4. Configure Secrets
```bash
# Store Google client secret
aws secretsmanager create-secret \
  --name GoogleClientSecret \
  --secret-string "your-secret"

# Store LiveKit credentials
aws secretsmanager create-secret \
  --name LiveKitUrl \
  --secret-string "wss://..."
aws secretsmanager create-secret \
  --name LiveKitApiKey \
  --secret-string "your-api-key"
aws secretsmanager create-secret \
  --name LiveKitApiSecret \
  --secret-string "your-api-secret"
```

### 5. Deploy Lambda Functions
After rewriting modules, deploy via SAM:
```bash
cd server
sam build
sam deploy
```

### 6. Update Frontend Configurations

**Website** (`website/config.js`):
```javascript
const API_BASE_URL = 'https://<API-DISTRIBUTION-DOMAIN>';
const GOOGLE_CLIENT_ID = '...';
```

**Mobile App**:
```bash
flutter build web --release \
  --dart-define-from-file=config/google.json \
  --dart-define=API_BASE_URL=https://<API-DISTRIBUTION-DOMAIN>
```

## Code Migration Pattern

### Before (Cloudflare/D1):
```javascript
const user = await env.DB.prepare(
  'SELECT * FROM users WHERE id = ?'
).bind(userId).first();
```

### After (AWS/DynamoDB):
```javascript
const user = await env.DYNAMO.get({
  TableName: env.USERS_TABLE,
  Key: { id: userId }
}).then(res => res.Item);
```

### Before (Cloudflare/R2):
```javascript
await env.PHOTOS.put(key, data, {
  httpMetadata: { contentType: 'image/jpeg' }
});
```

### After (AWS/S3):
```javascript
await s3Client.send(new PutObjectCommand({
  Bucket: env.PHOTOS_BUCKET,
  Key: key,
  Body: data,
  ContentType: 'image/jpeg'
}));
```

## Testing Strategy

### 1. Unit Tests
- Test each module with DynamoDB Local
- Mock AWS services where possible

### 2. Integration Tests
- Deploy to dev environment
- Test all API endpoints
- Verify database operations

### 3. End-to-End Tests
- Test user registration/login
- Test item creation/purchase
- Test chat/notifications
- Test admin features

### 4. Performance Tests
- Load test with API Gateway
- Monitor DynamoDB throttling
- Check Lambda cold starts

## Rollback Plan

### If migration fails:
1. Keep Cloudflare Workers running
2. Switch DNS back to Cloudflare
3. Delete AWS resources (if unused)
4. Investigate and fix issues

### If data migration fails:
1. Keep D1 as source of truth
2. Re-run migration script
3. Verify data integrity before cutover

## Cost Optimization

### DynamoDB:
- Use on-demand capacity during testing
- Switch to provisioned capacity for production
- Enable TTL for sessions table
- Use GSI sparingly

### Lambda:
- Set appropriate memory/timeouts
- Enable Lambda Provisioned Concurrency for critical paths
- Use Lambda Layers for shared code

### S3:
- Enable lifecycle policies for old photos
- Use intelligent tiering
- Compress assets

### CloudFront:
- Enable caching for static assets
- Use price class to limit regions
- Monitor data transfer costs

## Security Considerations

1. **IAM Roles**: Use least privilege for each Lambda
2. **API Keys**: Store in Secrets Manager, never in code
3. **Encryption**: Enable at-rest encryption for DynamoDB/S3
4. **CORS**: Restrict to specific origins in production
5. **Rate Limiting**: Use API Gateway throttling
6. **WAF**: Consider WAF for API Gateway
7. **VPC**: Consider VPC for Lambda if needed

## Monitoring

### CloudWatch Alarms:
- Lambda error rate
- API Gateway 5XX errors
- DynamoDB throttling
- S3 4XX/5XX errors

### Dashboards:
- Request count/latency
- Active users
- Order volume
- Error rates

## Next Steps

1. **Priority 1**: Rewrite auth.js (critical for all other features)
2. **Priority 2**: Rewrite items.js (core marketplace functionality)
3. **Priority 3**: Rewrite orders.js (transactions)
4. **Priority 4**: Rewrite social.js (chat, follows, etc.)
5. **Priority 5**: Rewrite remaining modules
6. **Priority 6**: Deploy and test end-to-end
7. **Priority 7**: Migrate production data
8. **Priority 8**: Update DNS and cutover

## Estimated Timeline

- Module rewrites: 2-3 weeks
- Database migration: 3-5 days
- Testing: 1 week
- Deployment & cutover: 2-3 days

**Total: 3-4 weeks**

## Resources

- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/)
- [DynamoDB Document Client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-dynamodb/)
- [Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)
- [API Gateway](https://docs.aws.amazon.com/apigateway/)
- [Lambda](https://docs.aws.amazon.com/lambda/)

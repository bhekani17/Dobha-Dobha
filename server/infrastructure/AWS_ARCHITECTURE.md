# AWS Migration Architecture for Dobha-Dobha

## Overview
Migration from Cloudflare Workers + D1 + R2 to AWS serverless infrastructure.

## AWS Architecture

### Compute Layer
- **AWS Lambda** (Node.js 22) - Replaces Cloudflare Workers
  - 98 API routes split into logical Lambda functions:
    - `auth-lambda`: register, login, google, logout, forgot, reset, me, updateMe, deleteAccount, changePassword
    - `items-lambda`: list, create, mine, get, update, remove, like, save, comments, report, upload
    - `orders-lambda`: list, create, dispatch, confirm, dispute, resolve, review, wallet, topup, withdraw
    - `social-lambda`: cart, offers, users, follow, chats, reviews
    - `notifications-lambda`: list, unread, markRead
    - `support-lambda`: user requests, admin operations
    - `admin-lambda`: disputes, reports, moderation
    - `live-lambda`: rooms, token (LiveKit integration)
    - `cleanup-lambda`: scheduled cleanup (replaces cron triggers)

- **API Gateway** (REST API) - Route requests to Lambda functions
  - Authorizer: Cognito User Pool or custom authorizer for Google tokens
  - CORS enabled for frontend origins
  - Request/response validation
  - Usage plans and throttling (replaces Cloudflare Rate Limits)

### Database Layer
- **Amazon DynamoDB** - Replaces Cloudflare D1 (SQLite)
  - Tables (1:1 mapping from D1 schema):
    - `UsersTable` (PK: id, GSI: email, handle)
    - `SessionsTable` (PK: token_hash, GSI: user_id)
    - `ItemsTable` (PK: id, GSI: seller_id, GSI: status+created_at)
    - `LikesTable` (PK: user_id#item_id, GSI: item_id)
    - `SavesTable` (PK: user_id#item_id)
    - `CommentsTable` (PK: id, GSI: item_id+created_at)
    - `OrdersTable` (PK: id, GSI: buyer_id, GSI: seller_id)
    - `WalletsTable` (PK: user_id)
    - `TransactionsTable` (PK: id, GSI: user_id+created_at)
    - `CartItemsTable` (PK: user_id#item_id)
    - `OffersTable` (PK: id, GSI: buyer_id, GSI: seller_id, GSI: item_id)
    - `FollowsTable` (PK: follower_id#seller_id, GSI: seller_id)
    - `MessagesTable` (PK: id, GSI: sender_id#recipient_id#created_at, GSI: recipient_id#read_at)
    - `ReviewsTable` (PK: order_id, GSI: seller_id+created_at)
    - `NotificationsTable` (PK: id, GSI: user_id+created_at)
    - `ReportsTable` (PK: id, GSI: status)
    - `ProfileTable` (PK: user_id)
    - `SupportRequestsTable` (PK: id, GSI: status)
    - `PushNotificationsTable` (PK: id, GSI: user_id+created_at)

- **DynamoDB Streams** - For real-time updates (chat, notifications)
  - Triggers Lambda functions for push notifications

### Storage Layer
- **Amazon S3** - Replaces Cloudflare R2
  - `dobha-photos` bucket: item photos
  - `dobha-website` bucket: static website assets
  - Lifecycle policies for cleanup
  - CORS configuration

- **CloudFront** - CDN and static hosting
  - Distribution for website (S3 origin)
  - Distribution for API (API Gateway origin with caching)
  - Custom domain support
  - Signed URLs for private photos

### Authentication
- **Amazon Cognito User Pool** - User authentication
  - Email/password sign-up/sign-in
  - Forgot password (email via SES)
  - MFA support (optional)
  - JWT tokens for API authorization

- **Google OAuth Integration** - Keep existing Google sign-in
  - Cognito identity provider: Google
  - Or custom Lambda authorizer validating Google ID tokens
  - Existing client IDs will be reused

### Real-time & Messaging
- **Amazon API Gateway WebSocket API** - Replaces real-time features
  - Chat rooms and live updates
  - Connections stored in DynamoDB
  - $disconnect, $default routes

- **Amazon SQS** - Queue for push notifications
  - Reliable delivery
  - Dead-letter queue for failed messages

- **Amazon SNS** - Push notifications
  - FCM integration for mobile
  - Platform applications for iOS/Android

### Live Streaming
- **Keep LiveKit** - Existing LiveKit integration
  - Lambda generates tokens
  - LiveKit server remains external or self-hosted on EC2
  - Alternative: AWS IVS (Amazon Interactive Video Service)

### Email
- **Amazon SES** - Replaces Cloudflare Email Service
  - Transactional emails (forgot password, support replies)
  - Verified domains
  - Rate limiting and bounce handling

### Monitoring & Operations
- **AWS CloudWatch** - Logs and metrics
  - Lambda logs
  - API Gateway metrics
  - Custom metrics (active users, orders, etc.)
  - Alarms for errors

- **AWS X-Ray** - Distributed tracing
  - Request tracing across services
  - Performance analysis

- **AWS CloudTrail** - Audit logging
  - API call history
  - Security monitoring

### Deployment
- **AWS SAM (Serverless Application Model)** - Infrastructure as Code
  - `template.yaml` for entire stack
  - CI/CD via CodePipeline + CodeBuild
  - Existing `buildspec.yml` can be updated

- **Parameter Store / Secrets Manager** - Configuration
  - API keys, database credentials
  - Environment-specific configs

## Migration Strategy

### Phase 1: Infrastructure Setup
1. Create SAM template with all resources
2. Deploy to dev environment (af-south-1)
3. Verify resource creation

### Phase 2: Database Migration
1. Export D1 data to CSV/JSON
2. Transform to DynamoDB format
3. Import to DynamoDB tables
4. Validate data integrity

### Phase 3: Backend Migration
1. Refactor each module for Lambda:
   - Replace D1 with DynamoDB Document Client
   - Replace R2 with S3 SDK
   - Replace Cloudflare bindings with AWS SDK
   - Handle Lambda context and errors
2. Implement API Gateway integration
3. Add authentication/authorization

### Phase 4: Frontend Updates
1. Update website config for new API endpoint
2. Update mobile app config for new API endpoint
3. Test authentication flow
4. Test all features

### Phase 5: Cutover
1. Deploy to production
2. DNS cutover to CloudFront
3. Monitor for issues
4. Keep Cloudflare as rollback option

## Cost Considerations

### Estimated Monthly Costs (af-south-1)
- Lambda: ~$20-50 (depending on usage)
- API Gateway: ~$10-30
- DynamoDB: ~$20-100 (depending on read/write capacity)
- S3: ~$5-20 (storage + requests)
- CloudFront: ~$10-30 (data transfer)
- Cognito: ~$5-15
- SES: ~$1-5 (emails)
- SQS/SNS: ~$5-10
- CloudWatch: ~$5-10
- **Total: ~$81-270/month**

Set up AWS Budget alerts to control costs.

## Security
- IAM roles with least privilege
- API Gateway authorizers
- S3 bucket policies
- DynamoDB encryption at rest
- VPC endpoints (if using VPC)
- WAF for API Gateway (optional)
- Secrets Manager for sensitive data

## Data Migration Plan
1. **Backup**: Export all D1 data before migration
2. **Transform**: Convert SQLite schema to DynamoDB schema
3. **Import**: Use AWS Data Pipeline or custom script
4. **Verify**: Compare record counts and samples
5. **Sync**: Dual-write during transition period
6. **Cutover**: Switch read/write to DynamoDB
7. **Cleanup**: Remove D1 after verification

## Rollback Plan
- Keep Cloudflare Workers running during transition
- Feature flags to switch between backends
- Database sync script for rollback
- DNS can be reverted quickly

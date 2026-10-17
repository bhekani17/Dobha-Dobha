// AWS Lambda wrapper for Cloudflare Worker compatibility
// Converts API Gateway events to Request objects and vice versa

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const {
  CognitoIdentityProviderClient,
} = require('@aws-sdk/client-cognito-identity-provider');
const { SESClient } = require('@aws-sdk/client-ses');
const { SNSClient } = require('@aws-sdk/client-sns');
const { SQSClient } = require('@aws-sdk/client-sqs');

const workerHandler = require('./index.js');

exports.handler = async function(event, context) {
  try {
    // Convert API Gateway event to Request
    const request = apiGatewayToRequest(event);

    // Create minimal env object with AWS SDK clients
    const env = createAwsEnv();

    // Call the original worker handler
    const response = await workerHandler.default.fetch(request, env, { waitUntil: () => {} });

    // Convert Response to API Gateway response
    return await responseToApiGateway(response);
  } catch (error) {
    console.error('Lambda handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_WEB_ORIGINS || '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

function apiGatewayToRequest(event) {
  const { path, httpMethod, headers, body, queryStringParameters } = event;

  const url = new URL(
    `${queryStringParameters ? '?' + new URLSearchParams(queryStringParameters).toString() : ''}`,
    `https://${headers.Host || 'localhost'}${path}`
  );

  const requestInit = {
    method: httpMethod,
    headers: headers || {},
  };

  if (body && httpMethod !== 'GET' && httpMethod !== 'HEAD') {
    requestInit.body = body;
  }

  return new Request(url, requestInit);
}

async function responseToApiGateway(response) {
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const body = await response.text();

  return {
    statusCode: response.status,
    headers: {
      ...headers,
      'Access-Control-Allow-Origin': process.env.ALLOWED_WEB_ORIGINS || '*',
    },
    body: body,
    isBase64Encoded: false,
  };
}

function createAwsEnv() {
  const region = process.env.AWS_REGION || 'af-south-1';

  const s3Client = new S3Client({ region });
  const cognitoClient = new CognitoIdentityProviderClient({ region });
  const sesClient = new SESClient({ region });
  const snsClient = new SNSClient({ region });
  const sqsClient = new SQSClient({ region });

  // Import database adapter
  const { createDatabase } = require('./db-adapter.js');

  return {
    // Database - PostgreSQL adapter that mimics D1 interface
    DB: createDatabase({
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_NAME: process.env.DB_NAME,
      DB_USER: process.env.DB_USER,
      DB_PASSWORD: process.env.DB_PASSWORD,
    }),

    // S3
    PHOTOS_BUCKET: process.env.PHOTOS_BUCKET,
    PHOTOS: {
      put: async (key, data, options) => {
        const command = {
          Bucket: process.env.PHOTOS_BUCKET,
          Key: key,
          Body: data,
          ContentType: options?.httpMetadata?.contentType,
        };
        await s3Client.send(new PutObjectCommand(command));
      },
      get: async (key) => {
        const command = {
          Bucket: process.env.PHOTOS_BUCKET,
          Key: key,
        };
        const result = await s3Client.send(new GetObjectCommand(command));
        return result.Body;
      },
      delete: async (key) => {
        const command = {
          Bucket: process.env.PHOTOS_BUCKET,
          Key: key,
        };
        await s3Client.send(new DeleteObjectCommand(command));
      },
      list: async (options) => {
        const command = {
          Bucket: process.env.PHOTOS_BUCKET,
          Prefix: options?.prefix,
        };
        const result = await s3Client.send(new ListObjectsV2Command(command));
        return result.Contents || [];
      },
    },

    // Cognito
    COGNITO: cognitoClient,
    USER_POOL_ID: process.env.USER_POOL_ID,
    USER_POOL_CLIENT_ID: process.env.USER_POOL_CLIENT_ID,

    // SES
    EMAIL: sesClient,

    // SNS
    SNS: snsClient,

    // SQS
    SQS: sqsClient,
    PUSH_QUEUE_URL: process.env.PUSH_QUEUE_URL,

    // Secrets
    LIVEKIT_URL: process.env.LIVEKIT_URL,
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,

    // Configuration
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    GOOGLE_CLIENT_IDS: process.env.GOOGLE_CLIENT_IDS,
    ALLOWED_WEB_ORIGINS: process.env.ALLOWED_WEB_ORIGINS,
  };
}

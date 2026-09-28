const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    UpdateCommand,
    DeleteCommand,
    QueryCommand,
    ScanCommand
} = require('@aws-sdk/lib-dynamodb');

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

const clientConfig = { region };

// If explicit credentials are provided in env vars, use them; otherwise default AWS credential chain (e.g. ECS task IAM role)
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
}

const client = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: true
    }
});

const TABLES = {
    USERS: process.env.USERS_TABLE || 'skytrade-users',
    ITEMS: process.env.ITEMS_TABLE || 'skytrade-items',
    MESSAGES: process.env.MESSAGES_TABLE || 'skytrade-messages',
    WISHLISTS: process.env.WISHLISTS_TABLE || 'skytrade-wishlists',
    CARTS: process.env.CARTS_TABLE || 'skytrade-carts'
};

module.exports = {
    client,
    docClient,
    TABLES,
    GetCommand,
    PutCommand,
    UpdateCommand,
    DeleteCommand,
    QueryCommand,
    ScanCommand
};

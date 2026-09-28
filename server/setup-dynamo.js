const {
    CreateTableCommand,
    DescribeTableCommand,
    ListTablesCommand
} = require('@aws-sdk/client-dynamodb');
const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { client, docClient, TABLES } = require('./dynamo');

async function tableExists(tableName) {
    try {
        await client.send(new DescribeTableCommand({ TableName: tableName }));
        return true;
    } catch (err) {
        if (err.name === 'ResourceNotFoundException') return false;
        throw err;
    }
}

async function createTables() {
    console.log(`Checking DynamoDB tables in region: ${process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'}...`);

    // 1. Users Table
    if (!(await tableExists(TABLES.USERS))) {
        console.log(`Creating table: ${TABLES.USERS}...`);
        await client.send(new CreateTableCommand({
            TableName: TABLES.USERS,
            BillingMode: 'PAY_PER_REQUEST',
            AttributeDefinitions: [
                { AttributeName: 'id', AttributeType: 'S' },
                { AttributeName: 'email', AttributeType: 'S' }
            ],
            KeySchema: [
                { AttributeName: 'id', KeyType: 'HASH' }
            ],
            GlobalSecondaryIndexes: [
                {
                    IndexName: 'EmailIndex',
                    KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
                    Projection: { ProjectionType: 'ALL' }
                }
            ]
        }));
        console.log(` ${TABLES.USERS} created.`);
    } else {
        console.log(` ${TABLES.USERS} already exists.`);
    }

    // 2. Items Table
    if (!(await tableExists(TABLES.ITEMS))) {
        console.log(`Creating table: ${TABLES.ITEMS}...`);
        await client.send(new CreateTableCommand({
            TableName: TABLES.ITEMS,
            BillingMode: 'PAY_PER_REQUEST',
            AttributeDefinitions: [
                { AttributeName: 'id', AttributeType: 'S' },
                { AttributeName: 'category', AttributeType: 'S' },
                { AttributeName: 'status', AttributeType: 'S' },
                { AttributeName: 'seller_id', AttributeType: 'S' },
                { AttributeName: 'created_at', AttributeType: 'S' }
            ],
            KeySchema: [
                { AttributeName: 'id', KeyType: 'HASH' }
            ],
            GlobalSecondaryIndexes: [
                {
                    IndexName: 'CategoryIndex',
                    KeySchema: [
                        { AttributeName: 'category', KeyType: 'HASH' },
                        { AttributeName: 'created_at', KeyType: 'RANGE' }
                    ],
                    Projection: { ProjectionType: 'ALL' }
                },
                {
                    IndexName: 'StatusIndex',
                    KeySchema: [
                        { AttributeName: 'status', KeyType: 'HASH' },
                        { AttributeName: 'created_at', KeyType: 'RANGE' }
                    ],
                    Projection: { ProjectionType: 'ALL' }
                },
                {
                    IndexName: 'SellerIndex',
                    KeySchema: [
                        { AttributeName: 'seller_id', KeyType: 'HASH' },
                        { AttributeName: 'created_at', KeyType: 'RANGE' }
                    ],
                    Projection: { ProjectionType: 'ALL' }
                }
            ]
        }));
        console.log(`✅ ${TABLES.ITEMS} created.`);
    } else {
        console.log(`ℹ️  ${TABLES.ITEMS} already exists.`);
    }

    // 3. Messages Table
    if (!(await tableExists(TABLES.MESSAGES))) {
        console.log(`Creating table: ${TABLES.MESSAGES}...`);
        await client.send(new CreateTableCommand({
            TableName: TABLES.MESSAGES,
            BillingMode: 'PAY_PER_REQUEST',
            AttributeDefinitions: [
                { AttributeName: 'id', AttributeType: 'S' },
                { AttributeName: 'receiver_id', AttributeType: 'S' },
                { AttributeName: 'sender_id', AttributeType: 'S' },
                { AttributeName: 'created_at', AttributeType: 'S' }
            ],
            KeySchema: [
                { AttributeName: 'id', KeyType: 'HASH' }
            ],
            GlobalSecondaryIndexes: [
                {
                    IndexName: 'ReceiverIndex',
                    KeySchema: [
                        { AttributeName: 'receiver_id', KeyType: 'HASH' },
                        { AttributeName: 'created_at', KeyType: 'RANGE' }
                    ],
                    Projection: { ProjectionType: 'ALL' }
                },
                {
                    IndexName: 'SenderIndex',
                    KeySchema: [
                        { AttributeName: 'sender_id', KeyType: 'HASH' },
                        { AttributeName: 'created_at', KeyType: 'RANGE' }
                    ],
                    Projection: { ProjectionType: 'ALL' }
                }
            ]
        }));
        console.log(`✅ ${TABLES.MESSAGES} created.`);
    } else {
        console.log(`ℹ️  ${TABLES.MESSAGES} already exists.`);
    }

    // 4. Wishlists Table
    if (!(await tableExists(TABLES.WISHLISTS))) {
        console.log(`Creating table: ${TABLES.WISHLISTS}...`);
        await client.send(new CreateTableCommand({
            TableName: TABLES.WISHLISTS,
            BillingMode: 'PAY_PER_REQUEST',
            AttributeDefinitions: [
                { AttributeName: 'user_id', AttributeType: 'S' },
                { AttributeName: 'item_id', AttributeType: 'S' }
            ],
            KeySchema: [
                { AttributeName: 'user_id', KeyType: 'HASH' },
                { AttributeName: 'item_id', KeyType: 'RANGE' }
            ]
        }));
        console.log(`✅ ${TABLES.WISHLISTS} created.`);
    } else {
        console.log(`ℹ️  ${TABLES.WISHLISTS} already exists.`);
    }

    // 5. Carts Table
    if (!(await tableExists(TABLES.CARTS))) {
        console.log(`Creating table: ${TABLES.CARTS}...`);
        await client.send(new CreateTableCommand({
            TableName: TABLES.CARTS,
            BillingMode: 'PAY_PER_REQUEST',
            AttributeDefinitions: [
                { AttributeName: 'user_id', AttributeType: 'S' },
                { AttributeName: 'item_id', AttributeType: 'S' }
            ],
            KeySchema: [
                { AttributeName: 'user_id', KeyType: 'HASH' },
                { AttributeName: 'item_id', KeyType: 'RANGE' }
            ]
        }));
        console.log(`✅ ${TABLES.CARTS} created.`);
    } else {
        console.log(`ℹ️  ${TABLES.CARTS} already exists.`);
    }

    // DynamoDB tables initialized cleanly without demo data
    console.log('✅ DynamoDB tables verified without fake/demo data.');
}

async function seedInitialData() {
    // Zero demo data policy
}

if (require.main === module) {
    createTables()
        .then(() => {
            console.log('🎉 DynamoDB initialization complete!');
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ DynamoDB setup error:', err);
            process.exit(1);
        });
}

module.exports = { createTables };

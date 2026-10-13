'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });

exports.handler = async (event) => {
  const batchItemFailures = [];
  for (const record of event.Records || []) {
    try {
      const notification = JSON.parse(record.body);
      if (!notification.id || !notification.userId || !notification.title || !notification.kind) {
        throw new Error('Malformed notification event');
      }
      await dynamodb.send(new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
          pk: `USER#${notification.userId}`,
          sk: `NOTIFICATION#${notification.createdAt}#${notification.id}`,
          id: notification.id,
          userId: notification.userId,
          kind: notification.kind,
          title: notification.title,
          body: notification.body || '',
          orderId: notification.orderId,
          itemId: notification.itemId,
          createdAt: notification.createdAt,
          expiresAt: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
        },
        ConditionExpression: 'attribute_not_exists(pk)',
      }));
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') continue;
      if (error.name === 'SyntaxError') console.error('Invalid notification queue payload', error);
      else console.error('Failed to persist notification', error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
};

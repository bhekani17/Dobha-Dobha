'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

exports.handler = async (event) => {
  const batchItemFailures = [];
  for (const record of event.Records || []) {
    try {
      const notification = JSON.parse(record.body);
      if (!notification.id || !notification.userId || !notification.kind || !notification.createdAt) {
        throw new Error('Malformed self-storage notification event.');
      }
      if (!Number.isFinite(Date.parse(notification.createdAt))) {
        throw new Error('Invalid self-storage notification timestamp.');
      }
      await db.send(new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
          pk: `USER#${notification.userId}`,
          sk: `NOTIFICATION#${notification.createdAt}#${notification.id}`,
          id: notification.id,
          userId: notification.userId,
          kind: notification.kind,
          unitId: notification.unitId,
          unitName: notification.unitName,
          createdAt: notification.createdAt,
          expiresAt: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
        },
        ConditionExpression: 'attribute_not_exists(pk)',
      }));
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') continue;
      console.error('Failed to persist self-storage notification', error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
};

'use strict';

const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const sqs = new SQSClient({});

exports.handler = async (event) => {
  for (const record of event.Records || []) {
    if (record.eventName !== 'INSERT' || !record.dynamodb?.NewImage) continue;
    const outbox = unmarshall(record.dynamodb.NewImage);
    if (!outbox.pk?.startsWith('OUTBOX#')) continue;
    if (!outbox.id || !outbox.userId || !outbox.kind || !outbox.createdAt) {
      throw new Error('Malformed self-storage notification outbox record.');
    }

    await sqs.send(new SendMessageCommand({
      QueueUrl: process.env.NOTIFICATIONS_QUEUE_URL,
      MessageBody: JSON.stringify({
        id: outbox.id,
        userId: outbox.userId,
        kind: outbox.kind,
        unitId: outbox.unitId,
        unitName: outbox.unitName,
        createdAt: outbox.createdAt,
      }),
    }));
  }
};

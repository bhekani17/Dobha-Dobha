'use strict';

const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const sqs = new SQSClient({});

exports.handler = async (event) => {
  for (const record of event.Records || []) {
    if (record.eventName !== 'INSERT' || !record.dynamodb?.NewImage) continue;
    const { unmarshall } = require('@aws-sdk/util-dynamodb');
    const outbox = unmarshall(record.dynamodb.NewImage);
    if (!outbox.pk?.startsWith('OUTBOX#')) continue;
    await sqs.send(new SendMessageCommand({
      QueueUrl: process.env.NOTIFICATIONS_QUEUE_URL,
      MessageBody: JSON.stringify({
        id: outbox.id,
        userId: outbox.userId,
        kind: outbox.kind,
        title: outbox.title,
        body: outbox.body || '',
        orderId: outbox.orderId,
        itemId: outbox.itemId,
        createdAt: outbox.createdAt,
      }),
    }));
  }
};

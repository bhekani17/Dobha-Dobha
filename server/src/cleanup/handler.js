'use strict';

const dynamo = require('../utils/dynamo');
const { now } = require('../utils/id');

exports.handler = async (event) => {
  console.log('Running daily cleanup job...', new Date().toISOString());

  const sessionsTable = process.env.SESSIONS_TABLE;
  let cleanedSessions = 0;

  if (sessionsTable) {
    try {
      const currentSeconds = Math.floor(Date.now() / 1000);
      const res = await dynamo.scan({
        TableName: sessionsTable,
        FilterExpression: 'expires_at < :now',
        ExpressionAttributeValues: { ':now': currentSeconds },
        Limit: 100,
      });

      for (const session of res.items) {
        await dynamo.delete(sessionsTable, { token_hash: session.token_hash });
        cleanedSessions++;
      }
    } catch (err) {
      console.error('Session cleanup error:', err);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Cleanup job completed',
      cleanedSessions,
      timestamp: now(),
    }),
  };
};

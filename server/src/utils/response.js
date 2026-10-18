'use strict';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      ...extraHeaders,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

function error(statusCode, message, extra = {}) {
  return json(statusCode, { error: message, ...extra });
}

function handleCors(event) {
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method);
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }
  return null;
}

function parseBody(event) {
  if (!event.body) return {};
  if (typeof event.body === 'object') return event.body;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

module.exports = {
  CORS_HEADERS,
  json,
  error,
  handleCors,
  parseBody,
};

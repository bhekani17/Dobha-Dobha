'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  BatchGetCommand,
} = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'af-south-1',
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: true,
  },
});

const dynamo = {
  client: docClient,

  async get(tableName, key) {
    const res = await docClient.send(new GetCommand({ TableName: tableName, Key: key }));
    return res.Item || null;
  },

  async put(tableName, item, conditionExpression = null, expressionAttributeNames = null, expressionAttributeValues = null) {
    const params = {
      TableName: tableName,
      Item: item,
    };
    if (conditionExpression) params.ConditionExpression = conditionExpression;
    if (expressionAttributeNames) params.ExpressionAttributeNames = expressionAttributeNames;
    if (expressionAttributeValues) params.ExpressionAttributeValues = expressionAttributeValues;
    return await docClient.send(new PutCommand(params));
  },

  async update(params) {
    return await docClient.send(new UpdateCommand(params));
  },

  async delete(tableName, key, conditionExpression = null, expressionAttributeNames = null, expressionAttributeValues = null) {
    const params = {
      TableName: tableName,
      Key: key,
    };
    if (conditionExpression) params.ConditionExpression = conditionExpression;
    if (expressionAttributeNames) params.ExpressionAttributeNames = expressionAttributeNames;
    if (expressionAttributeValues) params.ExpressionAttributeValues = expressionAttributeValues;
    return await docClient.send(new DeleteCommand(params));
  },

  async query(params) {
    const res = await docClient.send(new QueryCommand(params));
    return {
      items: res.Items || [],
      lastEvaluatedKey: res.LastEvaluatedKey,
      count: res.Count || 0,
    };
  },

  async scan(params) {
    const res = await docClient.send(new ScanCommand(params));
    return {
      items: res.Items || [],
      lastEvaluatedKey: res.LastEvaluatedKey,
      count: res.Count || 0,
    };
  },

  async transactWrite(transactItems) {
    return await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
  },

  async batchGet(requestItems) {
    const res = await docClient.send(new BatchGetCommand({ RequestItems: requestItems }));
    return res.Responses || {};
  },
};

module.exports = dynamo;

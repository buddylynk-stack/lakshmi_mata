const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

// Trim whitespace and newlines from env variables to prevent issues
const region = (process.env.AWS_REGION || "us-east-1").trim().replace(/[\r\n]/g, '');
const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim().replace(/[\r\n]/g, '');
const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim().replace(/[\r\n]/g, '');

const client = new DynamoDBClient({ 
  region: region,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey
  }
});

const docClient = DynamoDBDocumentClient.from(client);

module.exports = { docClient, client };

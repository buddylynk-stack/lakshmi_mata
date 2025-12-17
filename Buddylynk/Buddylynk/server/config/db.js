const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

// Use EC2 IAM role - no credentials needed
const client = new DynamoDBClient({ 
  region: "us-east-1"
});

const docClient = DynamoDBDocumentClient.from(client);

module.exports = { docClient, client };

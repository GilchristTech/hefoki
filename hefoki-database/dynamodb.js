import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  ScanCommand,
  BatchGetItemCommand,
  BatchWriteItemCommand
} from  "@aws-sdk/client-dynamodb";

import HeadlinesInterface from './headlines-interface.js';


let dynamodb_client = null;


function getDynamoDBClient (use_client=null) {
  if (use_client !== null) {
    return use_client;
  }

  if (dynamodb_client === null) {
    dynamodb_client = new DynamoDBClient();
  }

  return dynamodb_client;
}


export default class HeadlinesInterfaceDynamoDB extends HeadlinesInterface {
  async connect (client=null, table_name=null) {
    this.client     = getDynamoDBClient(client);
    this.table_name = table_name || "HefokiHeadlines";
  }

  assertClient () {
    if (this.client === undefined) {
      throw "HeadlinesInterfaceDynamoDB.client is undefined. Was this.connect() not ran?"
    }
    else if (!this.client) {
      throw "HeadlinesInterfaceDynamoDB.client is falsey. Was this.connect() not ran?"
    }
  }


  async getHeadlineDays (dates) {
    this.assertClient();

    if (! Array.isArray(dates)) {
      dates = [ dates ];
    }

    if (dates.length == 0) {
      return {};
    }

    const command = new BatchGetItemCommand({
      RequestItems: {
        [this.table_name]: {
          Keys: dates.map(date => {
            return { Date: { S: date } };
          })
        }
      }
    });

    const command_result = await this.client.send(command);
    let   headline_days  = {};

    for (let day_result of command_result.Responses[this.table_name]) {
      headline_days[day_result.Date.S] = JSON.parse(day_result.Data.S);
    }

    return headline_days;
  }


  async updateHeadlineDays (day_headlines) {
    this.assertClient();

    const command = new BatchWriteItemCommand({
      RequestItems: {
        [this.table_name]: Object.entries(day_headlines).map(
          ([date, headlines]) => ({
            PutRequest: {
              Item: {
                Date: { S: date },
                Data: { S: JSON.stringify(headlines) }
              }
            }
          })
        )
      }
    });

    return await this.client.send(command);
  }


  async * iterHeadlineDayPages () {
    this.assertClient();

    let last_evaluated_key = null;

    do {
      const command = new ScanCommand({
        TableName:         this.table_name,
        ExclusiveStartKey: last_evaluated_key,
      });

      const scan_output = await this.client.send(command);

      last_evaluated_key = scan_output.LastEvaluatedKey;

      if (!scan_output.Items) {
        continue;
      }

      const headline_days = {};

      for (let day_item of scan_output.Items) {
        headline_days[day_item.Date.S] = JSON.parse(day_item.Data.S);
      }
      yield headline_days;
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (last_evaluated_key);
  }
}

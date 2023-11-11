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
  async connect (client, table_name) {
    this.client     = getDynamoDBClient(client);
    this.table_name = table_name || "HefokiHeadlines";
  }


  async getHeadlineDays (dates) {
    if (! Array.isArray(dates)) {
      dates = [ dates ];
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
    /*
      Subclasses should implement.
    */

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
}

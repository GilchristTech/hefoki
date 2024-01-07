import runIncrementalBuildAndDeploy from './tasks/task-frontend.js';
import runUpdateHeadlines           from './tasks/task-headlines.js';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client       } from '@aws-sdk/client-s3';
import { CloudFront     } from '@aws-sdk/client-cloudfront';


const dynamodb_client   = new DynamoDBClient();
const s3_client         = new S3Client();
const cloudfront_client = new CloudFront();


export async function handler (event) {
  /*
    Check for headline updates, then if any are found, rebuild the static site
    and preform an incremental deployment.
  */
  try {
    const headlines_table_name = (
      event.headlines_table_name   || event.table_name   || event.TableName   ||
      process.env.HEFOKI_HEADLINES_TABLE_NAME ||
      null
    );

    const bucket = (
      event.bucket                          ||
      process.env.HEFOKI_PUBLIC_BUCKET_NAME ||
      process.env.BUCKET                    ||
      "hefoki-public"
    );

    const distribution_id = (
      event.cloudfront_distribution_id       ||
      event.distribution_id                  ||
      process.env.CLOUDFRONT_DISTRIBUTION_ID ||
      process.env.DISTRIBUTION_ID            ||
      null
    );

    const updated_headline_days = await runUpdateHeadlines({
      headlines_table_name,
      dynamodb_client,
    });
    
    const num_headlines = Object.values(updated_headline_days)
      .reduce((count, headlines) => count + (headlines.length ?? 0), 0);

    if (num_headlines === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          num_headlines,
          updated_headline_days
        })
      };
    }

    await runIncrementalBuildAndDeploy({
      dist: "/tmp/dist/",
      cloudfront_client,
      s3_client,
      headlines_table_name,
      bucket,
      distribution_id
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        num_headlines,
        updated_headline_days
      })
    };
  }
  catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" })
    }
  }
}

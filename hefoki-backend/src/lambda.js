import TaskIncrementalBuildAndDeploy from './tasks/task-frontend.js';
import TaskUpdateHeadlines           from './tasks/task-headlines.js';
import Task                          from './tasks/task.js';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client       } from '@aws-sdk/client-s3';
import { CloudFront     } from '@aws-sdk/client-cloudfront';

import { parseBoolean } from "./tasks/utils.js";

const dynamodb_client   = new DynamoDBClient();
const s3_client         = new S3Client();
const cloudfront_client = new CloudFront();


export async function handler (event={}) {
  /*
    Check for headline updates, then if any are found, rebuild the static site
    and preform an incremental deployment.
  */
  try {
    const options = {
      dynamodb_client,
      s3_client,
      cloudfront_client,

      include_content: false,
    };

    options.dry = (
      event.dry                     ||
      parseBoolean(process.env.DRY) ||
      false
    );

    options.headlines_table_name = (
      event.headlines_table_name || event.table_name || event.TableName ||
      process.env.HEFOKI_HEADLINES_TABLE_NAME ||
      null
    );

    options.bucket = (
      event.bucket                          ||
      process.env.HEFOKI_PUBLIC_BUCKET_NAME ||
      process.env.BUCKET                    ||
      "hefoki-public"
    );

    options.distribution_id = (
      event.cloudfront_distribution_id       ||
      event.distribution_id                  ||
      process.env.CLOUDFRONT_DISTRIBUTION_ID ||
      process.env.DISTRIBUTION_ID            ||
      null
    );

    const task_headlines = new TaskUpdateHeadlines(null, {
      ...options,
      update: !options.dry,
    }, {
      exclude: [
        "fetched_headlines",
        "headline_day_updates"
      ]
    });

    const task_increment = new TaskIncrementalBuildAndDeploy(null, {
      ...options,
      dist: "/tmp/dist/",
      deploy: !options.dry,
    }, {
      exclude: ["postprocess_content"]
    });

    const task_update = new Task("update-lambda", [], async (task) => {
      await task.runSubtask(task_headlines);

      if (task_headlines.details.num_headlines === 0)
        return;

      await task.runSubtask(task_increment);
    });

    try {
      await task_update.run();
    }
    catch (error) {
      console.error(error);
    }
    finally {
      return JSON.stringify(task_update);
    }
  }
  catch (error) {
    console.error("Error:", error);
    return {
      status: 500,
      error: "Internal server error"
    }
  }
}

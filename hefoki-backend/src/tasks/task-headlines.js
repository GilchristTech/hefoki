import Task from './task.js';

import { fetchHeadlines }         from '@hefoki/scraper/headlines';
import HeadlinesInterfaceDynamoDB from '@hefoki/database/dynamodb';
import hefokiFrontendBuild        from '@hefoki/frontend';
import * as Headlines             from '../logic/headlines.js';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import 'dotenv/config';

import Fs from 'fs';

export class TaskUpdateHeadlines extends Task {
  constructor (name=null, args=undefined, task="") {
    if (name === null)
      name = "update_headlines";
    super(name, args, task);
  }

  async handler (task, options={}) {
    /*
      Fetch headlines from the Current Events Portal, compare with headlines
      already in DynamoDB, then update headline days in the database where
      updates exist.
    */

    const do_update                = options.update ?? true;
    const force                    = options.force  ?? false;
    const dynamodb_client          = options.dynamodb_client ?? new DynamoDBClient();
    const headlines_table_name     = options.headlines_table_name || options.table_name || options.TableName || null;
    const headlines_url            = ( options.headlines_url || options.url ) ?? undefined;

    const { fetched_headlines } = await this.runSubtask(
        "fetch_headlines", null, {
          exclude: task.exclude,
          taskFunction: async (task) => {
            const fetched_headlines = await fetchHeadlines(headlines_url)

            const fetch_details = {
              fetched_headlines,
              num_headlines: fetched_headlines.length
            };

            return fetch_details;
          }
        }
      );

    const fetched_headline_days = Headlines.headlineArrayToHeadlineDays(fetched_headlines);

    const dates = Object.keys(fetched_headline_days);

    const headlines_interface = new HeadlinesInterfaceDynamoDB(dynamodb_client, headlines_table_name);
    await headlines_interface.connect();
    const old_headline_days = await headlines_interface.getHeadlineDays(dates);

    const headline_day_diffs = Headlines.diffHeadlineDays(
        old_headline_days,
        fetched_headline_days
      );

    const headlineDayDiffGroupFunction = (
      force
      ? Headlines.headlineDayDiffsToHeadlineDays
      : Headlines.headlineDayDiffsToUpdatedHeadlineDays
    );

    const headline_day_updates = headlineDayDiffGroupFunction(headline_day_diffs);
    const headline_updates     = Headlines.headlineDaysToHeadlineArray(headline_day_updates);

    // TODO: delete by the keys in headline_day_updates[*].deleted[*].date

    console.log(
      `Days updated (${dates.length} days, ${headline_updates.length} headlines):\n${
        dates.map(d => d + ": " + headline_day_updates[d].length.toString().padStart(2)).join("\n")
      }`
    );

    if (headline_updates.length === 0) {
      console.log("No headline updates");
    }
    else if (do_update) {
      console.log("Updating database");
      await headlines_interface.updateHeadlineDays(
          headline_day_updates
        );
    }

    const details = {
        dates:         dates,
        num_dates:     dates.length,
        num_headlines: headline_updates.length,
        headline_day_updates,
      };

    return details;
  }
};

export default TaskUpdateHeadlines;

import { fetchHeadlines }         from '@hefoki/scraper/headlines';
import HeadlinesInterfaceDynamoDB from '@hefoki/database/dynamodb';
import hefokiFrontendBuild        from '@hefoki/frontend';
import * as Headlines             from '../logic/headlines.js';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import 'dotenv/config';

import Fs from 'fs';

export default async function runUpdateHeadlines (options={}) {
  /*
    Fetch headlines from the Current Events Portal, compare with headlines
    already in DynamoDB, then update headline days in the database where
    updates exist.
  */

  const do_update            = options.update ?? true;
  const force                = options.force  ?? false;
  const dynamodb_client      = options.dynamodb_client ?? new DynamoDBClient();
  const headlines_table_name = options.headlines_table_name || options.table_name || options.TableName || null;

  const new_headlines     = await fetchHeadlines();
  const new_headline_days = Headlines.headlineArrayToHeadlineDays(new_headlines);

  const dates = Object.keys(new_headline_days);

  const headlines_interface = new HeadlinesInterfaceDynamoDB(dynamodb_client, headlines_table_name);
  await headlines_interface.connect();
  const old_headline_days = await headlines_interface.getHeadlineDays(dates);

  const headline_day_diffs = Headlines.diffHeadlineDays(
      old_headline_days,
      new_headline_days
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

  return headline_day_updates;
}

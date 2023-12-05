import { fetchHeadlines }         from 'hefoki-scraper/headlines';
import HeadlinesInterfaceDynamoDB from 'hefoki-database/dynamodb';
import hefokiFrontendBuild        from 'hefoki-frontend';

import * as Headlines             from './headlines.js';

import Fs from 'fs';

import 'dotenv/config';

async function runUpdateHeadlines () {
  /*
    Fetch headlines from the Current Events Portal, compare with headlines
    already in DynamoDB, then update headline days in the database where
    updates exist.
  */

  const new_headline_days = Headlines.headlineArrayToHeadlineDays(
      await fetchHeadlines()
    );

  const dates = Object.keys(new_headline_days);

  const headlines_interface = new HeadlinesInterfaceDynamoDB();
  await headlines_interface.connect();
  const old_headline_days = await headlines_interface.getHeadlineDays(dates);

  const headline_day_diffs = Headlines.diffHeadlineDays(
      old_headline_days,
      new_headline_days
    );

  const headline_day_updates = Headlines.headlineDayDiffsToHeadlineDays(
      headline_day_diffs
    );

  headlines_interface.updateHeadlineDays(
      headline_day_updates
    );

  return headline_day_updates;
}

(async () => {
  // runHeadlineDayUpdates();
})();

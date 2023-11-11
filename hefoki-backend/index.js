import { fetchHeadlines } from 'hefoki-scraper/headlines';
import HeadlinesInterfaceDynamoDB from 'hefoki-database/dynamodb';
import Fs from 'fs';

import 'dotenv/config';

(async () => {
  const current_days        = JSON.parse(Fs.readFileSync("headlines.json"));
  const headlines_interface = new HeadlinesInterfaceDynamoDB();

  await headlines_interface.connect();
  await headlines_interface.updateHeadlineDays(current_days);

  for (let date in current_days) {
    console.log( await headlines_interface.getHeadlineDays(date) );
  }
})()

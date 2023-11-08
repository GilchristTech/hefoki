import * as Headlines from 'hefoki-scraper/headlines';
import fs             from "fs";


(async () => {
  const headlines = await Headlines.fetchHeadlines();
  console.log(headlines);
})()

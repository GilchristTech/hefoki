const Headlines = require('./headlines.js');
const fs = require("fs");


function parseHeadlinesFromFile (file) {
  const html = fs.readFileSync(file);
  return Headlines.parseHeadlinesFromHtml(html);
}


(async () => {
  const headlines = await Headlines.fetchHeadlines();
  console.log(headlines);
})()

import HeadlinesInterfaceDynamoDB from "../dynamodb.js";
import HeadlinesInterfaceSQLite3  from "../sqlite3.js";

const dyn = new HeadlinesInterfaceDynamoDB();
const sql = new HeadlinesInterfaceSQLite3();

await dyn.connect();
await sql.connect("./headlines.db");
await sql.ensureTable();


const headline_day_chunks = [];
let   producer_running = true;

async function produceHeadlineDayChunks () {
  for await (const headline_day_chunk of dyn.iterHeadlineDayPages()) {
    console.log("Download DynamoDB chunk:", Object.keys(headline_day_chunk).length, "days");
    headline_day_chunks.push(headline_day_chunk);
  }
  producer_running = false;
}

async function consumeHeadlineDayChunks () {
  while (producer_running) {
    if (headline_day_chunks.length == 0) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      continue;
    }

    const headline_day_chunk = headline_day_chunks.shift();
    console.log("Insert SQLite3 chunk:", Object.keys(headline_day_chunk).length, "days");
    await sql.updateHeadlineDays(headline_day_chunk);
  }
}


await Promise.all([
  produceHeadlineDayChunks(),
  consumeHeadlineDayChunks(),
]);

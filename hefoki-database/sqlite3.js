import Database from "better-sqlite3";
import HeadlinesInterface from './headlines-interface.js';

let sqlite3_database = null;


function getSQLite3Database (use_database=null) {
  if (sqlite3_database === null) {
    if (use_database === null) {
      use_database = ":memory:";
    }

    sqlite3_database = new Database(use_database)
  }

  return sqlite3_database;
}


export default class HeadlinesInterfaceSQLite3 extends HeadlinesInterface {
  async connect (database, table_name) {
    this.database   = getSQLite3Database(database);
    this.table_name = table_name || "hefoki_headlines";
  }

  assertDatabase () {
    if (this.database === undefined) {
      throw "HeadlinesInterfaceSQLite3.database is undefined. Was this.connect() not ran?";
    }
    else if (!this.database) {
      throw "HeadlinesInterfaceSQLite3.database is falsey. Was this.connect() not ran?";
    }

    // SQLite3 does not allow for parameterized table names. As
    // such, for adapter queries to have variable table names,
    // those names need to be inserted directly into query
    // strings. This can be done by allowing a limited character
    // set to prevent query injection.
    //
    const name_regex = /^[a-zA-Z0-9.-]+$/;
    if (!this.table_name) {
      throw "HeadlinesInterfaceSQLite3.table_name is falsey";
    }
    else if (name_regex.test(this.table_name)) {
      throw "HeadlinesInterfaceSQLite3.table_name is does not match "+name_regex;
    }
  }

  async ensureTable () {
    this.assertDatabase();

    this.database.prepare(`
      CREATE TABLE IF NOT EXISTS "${this.table_name}" (
        date TEXT CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'),
        data TEXT
      );
    `).run();
  }


  async getHeadlineDays (dates) {
    this.assertDatabase();

    if (! Array.isArray(dates)) {
      dates = [ dates ];
    }

    if (dates.length == 0) {
      return {};
    }

    const rows = this.database.prepare(
      `SELECT * FROM ? WHERE date IN (${
        "?".repeat(dates.length).slice(0, -1)
      })`
    ).all(this.table_name, ...dates);

    var headline_days = {};

    for (let row of rows) {
      headline_days[row.date] = JSON.parse(row.data);
    }

    return headline_days;
  }

  async updateHeadlineDays (day_headlines) {
    this.assertDatabase();
    
    const insertStatement = this.database.prepare(`
      INSERT INTO "${this.table_name}" (date, data) VALUES (@date, @data)
    `);

    const insertManyTransaction = this.database.transaction(() => {
      for (let [date, headlines] of Object.entries(day_headlines)) {
        insertStatement.run({
          date,
          data: JSON.stringify(headlines),
        });
      }
    });

    insertManyTransaction();
  }
}

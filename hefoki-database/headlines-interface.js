import { DateTime } from "luxon";


export function groupHeadlinesByDate (headlines) {
  const headlines_by_date = {};

  for (let headline of headlines) {
    const date_headlines = headlines_by_date[headline.date] = headlines_by_date[headline.date] ?? [];
    date_headlines.push(headline);
  }

  return headlines_by_date;
}


export default class HeadlinesInterface {
  /*
    In-memory Javascript object adapter
    Subclasses should override the following methods:
      - connect
      - getHeadlineDays
  */

  async connect () {
    /*
      Subclasses should implement this.
    */
    this.headline_days = {};
  }


  async getHeadlineDays (dates) {
    /*
      Subclasses should implement this.
    */
    if (! Array.isArray(dates)) {
      return [ this.headline_days[dates] ?? null ];
    }

    let headline_days = {};

    for (let date of dates) {
      headline_days[date] = this.headline_days[date];
    }

    return headline_days;
  }


  async updateHeadlineDays (day_headlines) {
    /*
      Set the headlines which are associated with a given day. If
      headlines existed for this day in the current state of a
      database but are not included in day_headlines, the
      difference should no longer be in the database after this
      update.

      Subclasses should implement this.
    */

    for (let [day, headlines] of Object.entries(day_headlines)) {
      this.headline_days[day] = headlines;
    }
  }


  async getLastHeadlineDays (num_days) {
    let dates = [];
    let date  = DateTime.now().startOf("day");

    for (let offset=0; offset < num_days; offset++) {
      dates.push( date.toISODate() );
      date = date.set({ day: date.day-1 });
    }

    return this.getHeadlineDays(dates);
  }
}

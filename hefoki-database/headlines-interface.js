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
      Subclasses should implement.
    */
    this.headline_days = {};
  }


  async getHeadlineDays (dates) {
    /*
      Subclasses should implement.
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
      Subclasses should implement.
    */

    for (let [day, headlines] of Object.entries(day_headlines)) {
      this.headline_days[day] = headlines;
    }
  }
}

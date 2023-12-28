const { DateTime } = require("luxon");


module.exports = async function () {
  const HeadlinesInterfaceDynamoDB = (await import('@hefoki/database/dynamodb')).default;
  const headlines_interface        = new HeadlinesInterfaceDynamoDB();

  await headlines_interface.connect();

  // Get the last sixty days to construct a query

  let dates = [];
  let date  = DateTime.now().startOf("day");

  for (let offset=0; offset < 60; offset++) {
    dates.push( date.toISODate() );
    date = date.set({ day: date.day-1 });
  }

  let headline_days = await headlines_interface.getHeadlineDays(dates);

  // Filter empty headline days

  for (let date of dates) {
    let headlines = headline_days[date];

    // Filter out empty headlines
    headlines = headlines?.filter(h => h.text.length > 0);

    // Delete days with no headlines
    if ( ! (headlines?.length > 1) ) {
      delete headline_days[date];
    }
  }

  // Reorganize the queried data structure into a new one
  //
  let yesterday_date = null;
  let prev_href      = null;

  headline_days = Object.keys(headline_days)
    .sort()
    .map(date => {
      const headlines = headline_days[date];
      let   href          = `/${ date      }/`;
      const day_prev_href = prev_href;
      prev_href           = href;
      yesterday_date      = date;

      return {
        date,
        href,
        headlines,
        prev_href: day_prev_href,
        next_href: null,  // will be calculated in another pass
        yesterday_date: (
          DateTime.fromISO(date)
          .set({ day: DateTime.fromISO(date).day-1 })
          .toISODate()
        ),
        tomorrow_date: (
          DateTime.fromISO(date)
          .set({ day: DateTime.fromISO(date).day+1 })
          .toISODate()
        )
      };
    });

  let next_href = null;
  
  for (let headline_day of headline_days.toReversed()) {
    headline_day.next_href = next_href;
    next_href              = headline_day.href;
  }

  return headline_days;
}

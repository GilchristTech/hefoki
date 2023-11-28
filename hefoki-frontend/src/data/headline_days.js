const { DateTime } = require("luxon");


function dateString (date_obj) {
  return (
    `${   date_obj.getFullYear()
    }-${ (date_obj.getMonth() + 1).toString().padStart(2, "0")
    }-${  date_obj.getDate().toString().padStart(2, "0") }`
  );
}


function getDateYesterday (date) {
  date = new Date( date );
  date.setDate( date.getDate() - 1 );
  return date;
}


module.exports = async function () {
  const HeadlinesInterfaceDynamoDB = (await import('hefoki-database/dynamodb')).default;
  const headlines_interface = new HeadlinesInterfaceDynamoDB();

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

  for (let date in headline_days) {
    let headlines = headline_days[date];

    // Filter out empty headlines
    headlines = headlines.filter(h => h.text.length > 0);

    // Delete days with no headlines
    if ( ! (headlines?.length > 1) ) {
      delete headline_days[date];
    }
  }

  // Reorganize the queried data structure into a new one
  headline_days = Object.entries(headline_days)
    .map(([date, headlines]) => ( {
      date,
      headlines,
      yesterday_date: (
        DateTime.fromISO(date)
        .set({ day: DateTime.fromISO(date).day-1 })
        .toISODate()
      )
    } ));

  // Sort by dates
  headline_days.sort(
    (a, b) => (a.date > b.date) * 2 - 1  // convert bools to -1 or 1
  );

  return headline_days;
}

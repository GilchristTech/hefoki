# Hefoki Backend

The Hefoki backend contains a script which, when invoked, uses the
[Hefoki scraper](https://github.com/GilchristTech/hefoki/tree/master/hefoki-scraper),
to collect headlines from the Wikipedia [Current Events Portal](https://en.wikipedia.org/wiki/Portal:Current_events),
compare the results with those stored in a database (handled by the DynamoDB [database adapter](https://github.com/GilchristTech/hefoki/tree/master/hefoki-database)),
and determine which headlines are new, updating the database to become current.

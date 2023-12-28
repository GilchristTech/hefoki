# Hefoki Backend

The Hefoki Backend module connects other isolated Hefoki NodeJS modules,
defines repeated tasks and logic for scraping and incremental static site
deployment, and provides and command-line interface to these tasks.

## Scripts

### `start`: Unified CLI entrypoint

Runs the main CLI script. Use `--` after the command to specify command-line arguments. For example

```bash
npm start -- scrape http://example.com/
```
### `headlines:update`: Scrape to Database

Calls the 
[Hefoki scraper](https://github.com/GilchristTech/hefoki/tree/master/hefoki-scraper),
to collect headlines from the Wikipedia [Current Events Portal](https://en.wikipedia.org/wiki/Portal:Current_events),
compare the results with those stored in a database (handled by the DynamoDB [database adapter](https://github.com/GilchristTech/hefoki/tree/master/hefoki-database)),
and determine which headlines are new, updating the database to become current.

#### Usage

To scrape the current events portal and update the database:
```bash
npm run scrape
```

Equivalent to:
```bash
npm run start -- headlines update
```

### `frontend:increment`: Build static site and incrementally deploy to S3

Hefoki is deployed as a static site on an S3 bucket, and built using the
[Hefoki Frontend Module](https://github.com/GilchristTech/hefoki/tree/master/hefoki-frontend).
The frontend module queries for recent headlines headlines, then compares the
files with existing static site files on the public S3 bucket. Only new and
updated files are uploaded to S3, but because Hefoki has paginated links, one
page with a unique URL for each date of stories, the next/previous links may
need to be updated in order to make previous builds work properly with current
builds. This script edits the HTML output of the static site build to reflect
this, and updates old page links as well.

#### Usage
```bash
npm run frontend:increment
```

Equivalent to:
```bash
npm run start -- frontend increment
```

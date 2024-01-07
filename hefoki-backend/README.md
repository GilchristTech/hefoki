# Hefoki Backend

The Hefoki Backend module connects other isolated Hefoki NodeJS modules,
defines repeated tasks and logic for scraping and incremental static site
deployment, provides a command-line interface for these tasks, and defines an
AWS Lambda function for cloud execution.

Being a static site hosted on an S3 bucket, Hefoki works by rebuilding a
portion of the site from its existing data, comparing this with the pages which
are already deployed, reconciling any differences in how pages are linked, and
deploying any new or modified files. This is primarily the case for the
paginated `next` and `previous` links on the daily news pages. Within Hefoki's
code, this process of modifying the pages is called "repagination", and the
overall partial deployment process is referred to as an "increment" or being
"incremental".

## NPM Scripts and CLI

### `start`: Unified CLI entrypoint

Runs the main CLI script. Use `--` after the command to specify command-line
arguments. For example:
```bash
npm start -- scrape http://example.com/
```
### `headlines:update`: Scrape to Database

Calls the 
[Hefoki scraper](https://github.com/GilchristTech/hefoki/tree/master/hefoki-scraper),
to collect headlines from the Wikipedia
[Current Events Portal](https://en.wikipedia.org/wiki/Portal:Current_events),
compare the results with those stored in a database (handled by the DynamoDB
[database adapter](https://github.com/GilchristTech/hefoki/tree/master/hefoki-database)),
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

## Updater Lambda function

The incremental deployment process is able to be deployed to AWS Lambda with
the handler exported by `src/lambda.js`. This function calls the scraper to
update the database, rebuilds the static frontend, incrementally deploys to S3,
and performs a CloudFront invalidation.

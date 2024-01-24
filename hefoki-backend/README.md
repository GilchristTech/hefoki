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

## Tasks, Logic, and Facades

The Hefoki backend attempts to divide its functionality into three types of
source files:

* **Logic**:     The code which works with data most directly. Individual
  functions can also read or write to other sources. These should be defined in
  `src/logic/`.

* **Tasks**:     Classes with a handler that represent a repeated logical
  action, but should ideally be modular with their data sources and
  destinations. The class structure makes sure that there is a consistent data
  structure for logging and metrics. These are defined in `src/tasks/`.

* **Facades**: The code which most directly communicates with a user or
  external source. The line between this and a task, conceptually, is somewhat
  blurred, but the main principle is that a facade should coordinate and
  change the settings of Tasks, and move the Tasks' output to where it needs to
  go (e.g: logs). A facade is more concerned with the setting in which the
  code is ran, and where it's communicating, than the nature of the data.
  Currently, the two facades are the command-line interface and the updater
  Lambda function. Interfaces are defined in `src/`.

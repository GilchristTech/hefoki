# Hefoki - Headlines extracted from Wikipedia

The Wikipedia [Current Events Portal](https://en.wikipedia.org/wiki/Portal:Current_events)
collects headlines from stories across the world, and the content can be a
useful resource for providing a concise overview of world news. This software
collects these headlines from the Current Events Portal, and tags the stories
with any included wiki links.

## [Backend](https://github.com/GilchristTech/hefoki/tree/master/hefoki-backend)

Location: `./hefoki-backend/`

Contains application logic.

## [Scraper](https://github.com/GilchristTech/hefoki/tree/master/hefoki-scraper)

Location: `./hefoki-scraper/`

NodeJS module for scraping headlines from the Wikipedia Current Events Portal.

## [Database](https://github.com/GilchristTech/hefoki/tree/master/hefoki-database)

Location: `./hefoki-database/`

NodeJS database adapter module for headlines.

## [AWS](https://github.com/GilchristTech/hefoki/tree/master/aws)

Location: `./aws/`

Contains scripts for managing AWS resources for Hefoki.

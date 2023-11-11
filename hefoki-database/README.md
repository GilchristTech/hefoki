# Hefoki Database Module

Currently, the Hefoki application is written with the intent of being deployed
using AWS DynamoDB for a database, but also to have an intermediate class which
hides the particulars of that implementation from the application. This allows
other persistent storage mediums or communication protocols to be added, and to
better isolate application components for testing.

This document describes each data structure's persistent storage model, but
this is not intended to directly translate to particular schema design choices
for a given data storage medium. Sections with Data Structure in their name are
intentionally non-specific. For example, in storing headlines and their
metadata, whether a row or document handled by an implementation interface
stores one or more headline/metadata entry can vary between implementations: a
document store may group multiple headlines into one date with child objects
containing metadata; but a future tabular store may have a row for each story,
and additional tables for metadata, or encode metadata into JSON stored on a
given columns. These details can vary between data store implementations.

## Headlines
### Headline Data Structure:
A given headline is represented with these fields:
* Date           (YYYY-MM-DD string or calendar date, non-unique primary key)
* ExternalLinks  (array of URL strings)
* Tags           (array of strings)
* Text           (String: UTF-8, Natural language, summarizing the story)

The adapter is written to be agnostic regarding whether a single row or
document contains one or more headlines.

### `HeadlinesInterface`: Abstract in-memory object interface
### `HeadlinesInterfaceDynamoDB`: DynamoDB interface

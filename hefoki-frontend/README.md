# Hefoki Frontend

Hefoki uses Eleventy to generate pages. When building, DynamoDB is queried for
the last 60 days of headlines, and those are used to determine which pages are
built. 

To build, run
```bash
npm run build
```

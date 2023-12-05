# Hefoki Frontend

Hefoki uses Eleventy to generate pages. When building, DynamoDB is queried for
the last 60 days of headlines, and those are used to determine which pages are
built. 

To build, run
```bash
npm run build
```

To build programmatically, the frontend can be imported as a module, providing
a default export of an async build function.
```javascript
// CommonJS
const hefokiFrontendBuild = require("hefoki-frontend");

// ES6
import hefokiFrontendBuild from "hefoki-frontend";

await hefokiFrontendBuild("./build_destination/")
```

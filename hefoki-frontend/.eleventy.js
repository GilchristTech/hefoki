const jmespath = require("jmespath");

module.exports = function (config) {
  config.addPassthroughCopy("static");
  config.addPlugin(require("eleventy-sass"));

  config.addFilter("search",         jmespath.search);
  config.addFilter("json_parse",     JSON.parse);
  config.addFilter("json_stringify", JSON.stringify);

  return {
    dir: {
      input:    "src",
      output:   "dist",
      data:     "data",
      includes: "includes",
    }
  }
};

const Eleventy = require("@11ty/eleventy");

async function hefokiFrontendBuild (destination_dir = null) {
  if (destination_dir === null) {
    destination_dir = "dist";
  }

  let eleventy = new Eleventy( __dirname + "/src", "dist", {
    configPath: __dirname + "/.eleventy.js"
  });
  await eleventy.write();
}

module.exports = hefokiFrontendBuild;

const Eleventy = require("@11ty/eleventy");
const Path     = require("path");

async function hefokiFrontendBuild (destination_dir = null) {
  if (destination_dir === null) {
    destination_dir = "./dist";
  }

  destination_dir = Path.resolve(destination_dir);

  //
  // When calling programmatically from another module, installing this one
  // through NPM, it appears Eleventy does not write any files unless we change
  // the working directory into this module. 
  //
  // Record the current working directory, change the working directory to that
  // of this module, build, and finally: return to the previous working
  // directory.
  //

  const prev_dir = process.cwd();
  process.chdir(__dirname);

  let eleventy;
  let write;

  try {
    const configPath = Path.join(__dirname, ".eleventy.js")
    const src        = Path.join(__dirname, "src")

    console.log("[frontend] config path:", configPath);
    console.log("[frontend]  input path:", src);
    console.log("[frontend] output path:", destination_dir);

    eleventy = new Eleventy("src", destination_dir, {
      configPath: ".eleventy.js"
    });

    write = await eleventy.write();
  }
  finally {
    process.chdir(prev_dir);
  }

  return write;
}

module.exports = hefokiFrontendBuild;

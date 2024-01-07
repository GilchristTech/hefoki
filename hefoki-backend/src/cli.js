import { Command } from 'commander';
const cli = new Command();
export default cli;

import * as Fs from 'fs/promises';

cli.version('1.0.0')
  .description('Hefoki backend command-line interface');

const cli_frontend_command = cli.command('frontend');

cli_frontend_command.command('increment')
  .description(
    'Incremental build and deployment of the frontend'
  )
  .allowExcessArguments(false)
  .option('--force',              'Overwrites existing files, regardless of modification detection')
  .option('--pagination [value]', 'Defines whether to check existing or new previous/next links on paginated HTML files', 'true')
  .option('--build-path <path>',  'Path to write when building the frontend', './dist/')
  .option('--clean',              'Clean the build files if building')
  .option('-q, --quiet',          'Suppress output')
  .option('--bucket',             'Use this bucket to read or upload static site files')
  .option('-d, --dry',            "Dry run, don't deploy to S3")
  .option('-I, --no-invalidate',  "Do not perform a CloudFront invalidation")
  .action(commandFrontendIncrement);

cli_frontend_command.command('deploy')
  .description('Deploys a built static site to a destination')
  .allowExcessArguments(false)
  .option('--force',              'Overwrites existing files, regardless of modification detection')
  .option('--pagination [value]', 'Defines whether to check existing or new previous/next links on paginated HTML files', 'true')
  .option('--build-path <path>',  'Path to write when building the frontend', './dist/')
  .option('--quiet, -q',          'Suppress output')
  .option('--bucket',             'Use this bucket to read or upload static site files');

const cli_headlines_command = cli.command('headlines')
  .description('Commands for headlines');

cli_headlines_command.command('update [urls...]')
  .description(
    "Find headlines from the Wikipedia Current Events Portal (or any number " +
    "of arbitrary URLs), and find new headlines relative to the contents of a " +
    "database. Exit with a code of 50 if no updates were found."
  )
  .option('--table-name <name>',   'A DynamoDB table name, DynamoDB ARN, or JSON file to track headlines with')
  .option('-q --quiet',            'Suppress output')
  .option('-d, --dry',             "Dry run, don't update database")
  .option('-o, --output <output>', 'A json file to output to, or "-" for STDOUT (can be used multiple times)',
    (value, prev) => prev.concat(value), []
  )
  .action(commandHeadlinesUpdate);


async function commandHeadlinesUpdate (urls, options) {
  const runUpdateHeadlines = (await import('./tasks/task-headlines.js')).default;
  const Headlines = (await import('./logic/headlines.js'));

  const dry    = options.dry ?? false;
  const update = !options.dry;
  const quiet  = options.quiet ?? false;

  const updated_headline_days = await runUpdateHeadlines({
    update, quiet
  });

  const updated_headlines = Headlines.headlineDaysToHeadlineArray(updated_headline_days);

  if (updated_headlines.length == 0) {
    for (let output of options.output) {
      if (output.endsWith(".json")) {
        await Fs.writeFile(output, "{}");
      }
    }
    process.exit(50);
    return;
  }

  for (let output of options.output) {
    if (output.endsWith(".json")) {
      await Fs.writeFile(output, JSON.stringify(updated_headline_days, null, 2));
    }
    else if (output === "-") {
      console.log(JSON.stringify(updated_headline_days, null, 2));
    }
  }
}


async function commandFrontendIncrement (options) {
  const runIncrementalBuildAndDeploy = (await import('./tasks/task-frontend.js')).default;
  options = { ...options };

  options.dry           ??= false;
  options.no_invalidate ??= false;
  options.skip_deploy     = options.dry;
  options.build_path      = options.buildPath;
  options.invalidate      = ! options.no_invalidate;

  await runIncrementalBuildAndDeploy(options);
}


import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await cli.parseAsync(process.argv);
}

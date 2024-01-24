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
  const { TaskUpdateHeadlines } = (await import('./tasks/task-headlines.js'));
  const Headlines = (await import('./logic/headlines.js'));

  const dry    = options.dry ?? false;
  const update = !options.dry;
  const quiet  = options.quiet ?? false;

  const update_task = new TaskUpdateHeadlines(null, {
    update, quiet
  });

  const {
    headline_day_updates,
    num_headlines
  } = await update_task.run();

  if (num_headlines == 0) {
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
      await Fs.writeFile(output, JSON.stringify(update_task, null, 2));
    }
    else if (output === "-") {
      console.log(JSON.stringify(update_task, null, 2));
    }
  }
}


async function commandFrontendIncrement (options) {
  options = { ...options };

  options.dry           ??= false;
  options.no_invalidate ??= false;
  options.skip_deploy     = options.dry;
  options.build_path      = options.buildPath;
  options.invalidate      = ! options.no_invalidate;

  const TaskIncrementalBuildAndDeploy = (await import('./tasks/task-frontend.js')).default
  const update_task = new TaskIncrementalBuildAndDeploy(null, options);
  const details = await update_task.run();

  console.log(JSON.stringify(update_task, null, 2));
}


import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await cli.parseAsync(process.argv);
}

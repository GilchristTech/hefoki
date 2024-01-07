import * as Frontend from '../logic/frontend.js';
import hefokiFrontendBuild from '@hefoki/frontend';

import Fs from 'fs';
import { rimraf } from 'rimraf';

import {
  S3Client, ListObjectsV2Command
} from '@aws-sdk/client-s3';

import {
  CloudFront
} from '@aws-sdk/client-cloudfront';

import 'dotenv/config';


const DEFAULT_DIST    = "dist";
const AWS_REGION      = process.env.AWS_REGION      || "us-west-2";
const BUCKET          = process.env.BUCKET          || "hefoki-public";
const DISTRIBUTION_ID = process.env.DISTRIBUTION_ID || null;
const DEFAULT_DOMAIN  = "hefoki.today";


function parseBoolean (value, default_value) {
  return Boolean((value && value != "false") ?? default_value)
}


export default async function runIncrementalBuildAndDeploy (options={}) {
  const dist = (
      options.dist       ||
      options.build_path || options.buildPath ||
      DEFAULT_DIST
    );

  const force              = parseBoolean(options.force,              false);
  const enforce_pagination = parseBoolean(options.enforce_pagination, true);
  const skip_deploy        = parseBoolean(options.skip_deploy,        false);
  const deploy             = parseBoolean(options.deploy,             !skip_deploy);
  const clean              = parseBoolean(options.clean,              true);
  const build              = parseBoolean(options.build,              clean);
  const quiet              = parseBoolean(options.quiet,              false);
  const invalidate         = parseBoolean(options.invalidate,         deploy);

  const domain             = options.domain    || DEFAULT_DOMAIN;
  const Region             = options.Region    || AWS_REGION;
  const Bucket             = options.Bucket    || options.bucket || BUCKET;
  const DistributionId     = options.distribution_id || options.DistributionId || DISTRIBUTION_ID;

  const s3_client          = options.s3_client         ?? new   S3Client({ Region });
  const cloudfront_client  = options.cloudfront_client ?? new CloudFront({ Region });

  //
  // Build
  //
  if (build) {
    if (!quiet) console.log("Building frontend...");
    if (clean) {
      await rimraf(dist);
    }
    const result = await hefokiFrontendBuild(dist);
  }

  //
  // Get new and existing build files
  //
  const existing_build_files = await Frontend.StaticSiteFileS3.fromListObjectsV2Command(
      s3_client, Bucket
    );
  const new_build_files = await Frontend.StaticSiteFileLocal.fromWalkDirectory(dist);

  if (!quiet)
    console.log("Postprocessing build...");

  const updates = await Frontend.buildPostprocess(
    existing_build_files,
    new_build_files,
    options
  );

  // Upload to S3

  if ( skip_deploy ) {
    if (!quiet) console.log("Skipping S3 deployment. Updated static site files:");
    for (let key in updates) {
      if (!quiet) console.log(" ", key);
    }
    return;
  }
  else if ( Object.keys(updates).length === 0 ) {
    if (!quiet) console.log("No new files or pages to upload to S3");
  }
  else {
    if (!quiet) console.log("Uploading postprocessed build files to S3...");
    await Frontend.uploadFilesToS3(updates, {
      ...options,
      invalidate,
      DistributionId
    });
  }
}

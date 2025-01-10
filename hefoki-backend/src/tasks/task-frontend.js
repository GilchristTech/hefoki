import Task from './task.js';

import * as Frontend from '../logic/frontend.js';

import {
  StaticSiteFileLocal,
  StaticSiteFileS3
} from '../logic/static-site-file.js';

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

import { parseBoolean, uploadFilesToS3 } from "./utils.js";


const DEFAULT_DIST    = "dist";
const AWS_REGION      = process.env.AWS_REGION      || "us-west-2";
const BUCKET          = process.env.BUCKET          || "hefoki-public";
const DISTRIBUTION_ID = process.env.DISTRIBUTION_ID || null;
const DEFAULT_DOMAIN  = "hefoki.today";


export class TaskIncrementalBuildAndDeploy extends Task {
  constructor (name=null, args=undefined, task="") {
    if (name === null)
      name = "increment_frontend";
    super(name, args, task);
  }

  async handler (task, options={}) {
    //
    // Options
    //
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

    const include_build_content = parseBoolean(options.include_build_content, false);

    const results = {};

    //
    // Build
    //
    if (build) {
      await this.runSubtask(
        "build", async () => {
          if (!quiet)
            console.log("Building frontend...");

          if (clean) {
            await rimraf(dist);
          }

          const eleventy_build_output = await hefokiFrontendBuild(dist);

          if ( ! include_build_content ) {
            for (let build_list of eleventy_build_output) {
              for (let build_object of build_list) {
                delete build_object.content;
              }
            }
          }

          return eleventy_build_output;
        }
      );
    }

    //
    // Get new and existing build files
    //
    const existing_build_files = await StaticSiteFileS3.fromListObjectsV2Command(
        s3_client, Bucket
      );
    const new_build_files = await StaticSiteFileLocal.fromWalkDirectory(dist);

    const postprocess_updates = await this.runSubtask(
      "postprocess_updates", {
        exclude: task.exclude,
        taskFunction: async () => {
          if (!quiet)
            console.log("Postprocessing build...");

          const postprocess_content = Object.fromEntries(
            Object.entries(
              await Frontend.incrementBetweenBuilds(existing_build_files, new_build_files, options)
            ).map(
              ([key, content]) => [key, content.toString()]
            )
          );

          let postprocess_size_total = 0;

          const postprocess_sizes = Object.fromEntries(
              Object.entries(postprocess_content).map(([key, content]) => {
                postprocess_size_total += content.length;
                return [key, content.length]
              })
            );

          return {
            postprocess_sizes,
            postprocess_size_total,
            postprocess_content
          };
        }
      }
    );

    //
    // Upload to S3
    //
    if ( skip_deploy ) {
      if (!quiet)
        console.log("Skipping S3 deployment. Updated static site files:");

      for (let key in postprocess_updates.postprocess_content) {
        if (!quiet)
          console.log(" ", key);
      }

      return;
    }

    await this.runSubtask("deploy", async () => {
      if ( Object.keys(postprocess_updates.postprocess_content).length === 0 ) {
        if (!quiet)
          console.log("No new files or pages to upload to S3");
        return;
      }

      if (!quiet)
        console.log("Uploading postprocessed build files to S3...");

      // TODO: instead of this being code in the Frontend logic module, this
      // should be broken down into subtasks for reporting purposes.

      return await uploadFilesToS3(postprocess_updates.postprocess_content, {
        ...options,
        invalidate,
        DistributionId
      });
    });
  }
}


export default TaskIncrementalBuildAndDeploy;

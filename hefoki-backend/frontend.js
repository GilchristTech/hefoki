import hefokiFrontendBuild from 'hefoki-frontend';

import { rimraf } from 'rimraf';
import cheerio    from 'cheerio';
import * as Luxon from 'luxon';
import Crypto     from 'crypto';
import Path       from 'path';
import Fs         from 'fs';

import {
  S3Client,
  GetObjectCommand, PutObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';

const default_dist = "dist";

const AWS_REGION = process.env.AWS_REGION || "us-west-2";
const BUCKET     = process.env.BUCKET     || "hefoki-public";


export class StaticSiteFile {
  constructor (directory, prefix, name) {
    this.directory   = directory;
    this.prefix      = prefix;
    this.name        = name;
    this.__content   = null;
    this.__s3_object = null;
  }

  get local_path () {
    if (this.directory === null) {
      throw new TypeError("No local directory defined (this may not be a file on the local filesystem");
    }

    return Path.join(this.directory, this.name);
  }

  get key () {
    return this.prefix + this.name;
  }

  async content () {
    if (this.__content === null) {
      this.__content = Fs.promises.readFile(this.local_path);
    }

    return await this.__content;
  }

  setContent (new_content) {
    this.__content = new_content;
  }

  async writeContent(new_content = null) {
    if (new_content !== null)
      this.setContent(new_content);

    return await Fs.promises.writeFile(
      this.local_path, await this.content()
    );
  }

  async hash () {
    const content = await this.content();
    return Crypto.createHash('md5').update(content).digest('hex');
  }
}


export async function * walkSSGFilesAsync (path, prefix="") {
  /*
    Recursive async generator for walking static site directories.
  */

  for await (let dirent of await Fs.promises.opendir(path)) {
    if (dirent.isDirectory()) {
      yield * walkSSGFilesAsync(
        Path.join(path, dirent.name),
        `${prefix}${dirent.name}/`
      );
    }
    else {
      yield new StaticSiteFile( path, prefix, dirent.name );
    }
  }
}


export function mergeIndexedArrays (indexes_a, indexes_b, values_a=null, values_b=null) {
  /*
    Returns an array of linked list nodes (linked by indices, not references)
    of two arrays of indices, along with their corresponding values,
    maintaining the order of indices. If value arrays are not provided, the
    indexes are used as values. The term "merge", in this context, refers to this
    process, and creating this data structure.

    This algorithm assumes the index arrays are already sorted.

    Returns
      [{
        index,
        a_value, b_value,
        prev,    next,
        a_prev,  a_next
        b_prev,  b_next
      }]
  */

  if (!(
    Array.isArray(indexes_a) ||
    Array.isArray(indexes_b)
  )) {
    throw TypeError("indexes_a and indexes_b must both be arrays");
  }

  // JavaScript arrays are not guaranteed to have contiguous indices; copying
  // the array better ensures the algorithm runs properly
  indexes_a = Array.from(indexes_a);
  indexes_b = Array.from(indexes_b);

  // The value properties in the return objects, if a values reference object
  // is not provided, defaults to the keys that are used. If a values lookup
  // object has been provided, convert it into a numerically-indexable array.
  values_a = ( values_a && indexes_a.map(i => values_a[i]) ) ?? indexes_a;
  values_b = ( values_b && indexes_b.map(i => values_b[i]) ) ?? indexes_b;

  const merged = [];

  let last_merge = null;
  let last_a     = null;
  let last_b     = null;

  // Iterate through both arrays until the end of both arrays are reached
  for (
    let a_i=0, b_i=0 ;
    a_i < indexes_a.length || b_i < indexes_b.length ;
    // depending on values, a_i and/or b_i are incremented inside the loop
  ) {
    // Get the current index from both arrays, handling cases where one array
    // is shorter than the other
    let a_index = indexes_a[a_i] ?? null;
    let b_index = indexes_b[b_i] ?? null;

    let merge_entry = {
      index:   null,
      a_value: null,
      b_value: null,
      prev:   last_merge?.index ?? null,
      next:   null,
      a_prev: null,       a_next: null,
      b_prev: null,       b_next: null,
    };

    // Determine the lowest value between the current index of the A and B
    // arrays, using both values if they are equal. In case of equal values,
    // the merged entry will contain the index along with both values,
    // representing the merge of elements from both arrays.

    if (a_index == b_index) {
      merge_entry.index   = a_index;

      merge_entry.a_value = values_a[a_i] ?? null;
      merge_entry.b_value = values_b[b_i] ?? null;

      merge_entry.a_prev  = last_a?.index ?? null;
      merge_entry.b_prev  = last_b?.index ?? null;

      if (last_a) last_a.a_next = a_index;
      if (last_b) last_b.b_next = a_index;

      last_a = merge_entry;
      last_b = merge_entry;

      a_i++;
      b_i++;
    }
    else if (( a_index < b_index ) && (  a_index !== null )) {
      merge_entry.index   = a_index;
      merge_entry.a_value = values_a[a_i] ?? null;
      merge_entry.a_prev  = last_a?.index ?? null;
      if (last_a) last_a.a_next = a_index;
      last_a = merge_entry;
      a_i++;
    }
    else {
      merge_entry.index = b_index;
      merge_entry.b_value = values_b[b_i] ?? null;
      merge_entry.b_prev = last_b?.index ?? null;
      if (last_b) last_b.b_next = b_index;
      last_b = merge_entry;
      b_i++;
    }

    merged.push(merge_entry);
    if (last_merge)
      last_merge.next = merge_entry.index;
    last_merge = merge_entry;
  }

  return merged;
}


export async function localBuildPostprocess (options={}) {
  /*
    Build static site, then compare the files with those in the existing static
    site public bucket. Upload updated a new files. For paginated links, edit
    their HTML before uploading to ensure evailable paginated links, and to
    download and do the same for old paginated links where needed.
  */
  // TODO: break this down into smaller, more testable functions

  const dist      = options.dist      ?? default_dist;
  const Region    = options.Region    ??   AWS_REGION;
  const Bucket    = options.Bucket    ??       BUCKET;

  const s3_client = options.s3_client ?? new S3Client({ Region });

  // Query and filter for existing date-paginated pages in the S3 bucket, and
  // put them into a dict indexed by date.

  const result = await s3_client.send(
    new ListObjectsV2Command({
      Bucket: Bucket,
      // TODO: filter by prefix
    })
  );

  const existing_objects = {};
  const ETAG_MD5_RGX     = /"?([0-9a-f]{32})"?/;
  const DATE_URL_KEY_RGX = /^\/?(\d{4}-\d{2}-[0-3][0-9])\//;

  const day_pages_existing = {};

  for (let object of result.Contents) {
    const hash_match = object.ETag.match(ETAG_MD5_RGX);

    if (hash_match === null) {
      throw TypeError(`Could not find an MD5 hash in ETag: ${hash_match.ETag}`);
    }

    object.hash = hash_match[1];
    existing_objects[object.Key] = object;

    const date_match = object.Key.match(DATE_URL_KEY_RGX);
    if (date_match) {
      day_pages_existing[date_match[1]] = object;
    }
  }

  //
  // For the new SSG build, walk through files, filter for pages paginated by
  // date, and add them to a dict, indexed by the date.
  //
  // Put all other build output files into static_pages, indexed by URL key,
  // and skipping files which already exist with matching hashes.
  //
  const day_pages_new = {};
  const static_pages  = {};

  for await (let new_page of walkSSGFilesAsync(dist)) {
    const date_match = new_page.prefix.match(DATE_URL_KEY_RGX);
    const hash = await new_page.hash();

    if ( ! date_match ) {
      const existing_page = existing_objects[new_page.key];

      // Skip uploading existing, matching pages
      if (existing_page?.hash === hash) {
        continue;
      }

      static_pages[new_page.key] = await new_page.content();
      continue;
    }

    const date = date_match[1];
    day_pages_new[date] = new_page;
  }

  // Prepare an array of merge entry objects to use for comparison of new
  // pages and old to flag pages who in need of their paginated links being
  // adjusted.
  //
  const day_pages_existing_keys = Object.keys(day_pages_existing).sort();
  const day_pages_new_keys      = Object.keys(day_pages_new).sort();

  const merged = mergeIndexedArrays(
    day_pages_existing_keys,
    day_pages_new_keys,
    day_pages_existing,
    day_pages_new
  );

  // Look for new/updated pages, and updated entries to the merged array,
  // annotating those merge objects with boolean flags about the types of
  // updates in that set of files.

  for (let merge of merged) {
    // There are various causes for which a page may be deployed. The most
    // obvious is that there simply is a new page, but there are other cases we
    // need to detect in pages where both a newly-generated and old page exist.
    // A page may also be updated because its content hash is different than
    // before, or that adjacent pages are added, requiring pagination links be
    // updated.
    //
    // For each merge entry (and by extension, each old and new SSG file),
    // perform these checks so that update operations may be later determined.

    const both_pages             = merge.a_value && merge.b_value;
    const is_new_page            = Boolean(!merge.a_value && merge.b_value );
    const is_hash_update         = both_pages && ( merge.a_value.hash !== await merge.b_value.hash() );
    const is_a_pagination_update = merge.a_value && merge.a_prev !== merge.prev || merge.a_next !== merge.next;
    const is_b_pagination_update = merge.b_value && merge.b_prev !== merge.prev || merge.b_next !== merge.next;

    const is_pagination_update   = is_b_pagination_update || ( is_a_pagination_update && ! is_hash_update );
    const is_content_update      = is_hash_update         || is_pagination_update;
    const is_update              = is_new_page            || is_content_update;

    Object.assign(merge, {
      is_update,
      is_content_update,
      is_pagination_update,
      is_new_page,
      is_hash_update,
      is_a_pagination_update,
      is_b_pagination_update,
    });
  }

  // Calculate updates
  // Use a map of async functions to parallelize S3 IO
  //
  await Promise.all( merged.map(async merge_entry => {
    if (! merge_entry.is_update)
      return;

    if (!merge_entry.is_content_update && merge_entry.is_new_page) {
      static_pages[merge_entry.index] = await merge_entry.b_value.content();
      return;
    }

    // If the new page's pagination is being updated, than an update to the old
    // page's pagination is irrelevant, since it will be overwritten. For this
    // reason, an if condition is used to prioritize updates to page B, the
    // more recent one.

    if (merge_entry.is_b_pagination_update) {
      const file     = merge_entry.b_value;
      const content  = await file.content();
      const new_html = updatePagination(content, merge_entry);
      await file.writeContent(new_html);
      static_pages[merge_entry.key] = new_html;
    }
    else if (merge_entry.is_a_pagination_update) {
      const Key = merge_entry.a_value.Key;

      const download_result = await s3_client.send(
        new GetObjectCommand({ Bucket, Key })
      );

      const content  = download_result.read();
      const new_html = updatePagination(content, merge_entry);

      static_pages[Key] = new_html;
    }
    else if (merge_entry.is_update) {
      // Pass this on to be uploaded with the rest of the static files
      static_pages[merge_entry.b_value.key] = await merge_entry.b_value.content();
    }
    else {
      throw new Error(`Not sure what do do with merge_entry; key: ${merge_entry.index}`);
    }
  }));

  return static_pages;
}


async function uploadFilesToS3 (static_pages, options={}) {
  /*
    Given a dict of static pages, where their indexes are object keys, and the
    values are the page content, upload each as an object to S3.
  */

  const Bucket = options.Bucket ??     BUCKET;
  const Region = options.Region ?? AWS_REGION;

  const s3_client = options.s3_client ?? new S3Client({ Region });

  const upload_promises = Object.entries(static_pages).map(async ([Key, Body]) => {
    console.log(`put: ${Bucket}/${Key} (${(Body.length/1024).toFixed(1)}kb)`);
    return await s3_client.send(
      new PutObjectCommand({ Bucket, Key, Body })
    );
  });

  return await Promise.all(upload_promises);
}


export async function incrementalBuildAndDeploy () {
  await rimraf("./dist/");

  console.log("Building frontend...");
  await hefokiFrontendBuild(default_dist);
  console.log("Postprocessing build...");
  const static_pages = await localBuildPostprocess({ dist: default_dist });

  if ( Object.keys(static_pages).length === 0 ) {
    console.log("No new files or pages to upload to S3");
  }
  else {
    console.log("Uploading postprocessed build files to S3...");
    await uploadFilesToS3(static_pages);
  }
}

await incrementalBuildAndDeploy();

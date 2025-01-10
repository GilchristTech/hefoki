import Cheerio    from 'cheerio';

import * as Luxon from 'luxon';
import Crypto     from 'crypto';
import Path       from 'path';
import Fs         from 'fs';
import Mime       from 'mime-types';

import {
  S3Client,
  GetObjectCommand, PutObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';

import { CloudFront } from '@aws-sdk/client-cloudfront';

const ETAG_MD5_RGX     = /"?([0-9a-f]{32})"?/;


export class StaticSiteFile {
  constructor (object={}) {
    // Resource key - for static sites, a path relative to the root of the
    // build, not including a leading slash. Also calculate the key_directory
    // and key_filename. The directory should include a trailing slash, and
    // simple concatination with key_filename should result in the exact
    // resource key

    if (typeof object.key !== "string")
      throw TypeError(`key isn't a string: ${object.key}`);

    this.key = object.key || object.resource_key;

    this.key_separator    = object.key_separator ?? "/";
    const key_fname_index = this.key.lastIndexOf(this.key_separator) + 1;
    this.key_directory    = this.key.slice(0, key_fname_index);
    this.key_filename     = this.key.slice(key_fname_index);

    // Locator - An implementation-agnostic string which can be resolved to
    // this resource.

    if (object.locator === null || object.locator === undefined) {
      this.locator           = null;
      this.locator_separator = null;
      this.locator_prefix    = null;
    }
    else if (typeof object.locator !== "string") {
      throw new TypeError("locator is not a string or null");
    }
    else {
      this.locator           = object.locator;
      this.locator_separator = object.locator_separator ?? "/";

      if (object.locator_prefix) {
        this.locator_prefix = object.locator_prefix;
      }
      else if (this.locator.endsWith(this.key)) {
        this.locator_prefix = this.locator.slice(0, -this.key.length);
      }
      else {
        this.locator_prefix = null;
      }
    }

    this.mimetype  = object.mimetype ?? Mime.lookup(this.key_name);
    this.__content = object.content  ?? null;
    this.__hash    = object.hash     ?? null;
    this.modified  = false;
  }

  static localizePath (global_path, prefix="") {
    /*
      Return a path after a given prefix within a global path

      For most static site implementations, it can be useful to have a means of
      resolving the relative location between the root of a resource medium
      (such as a filesystem, URI, or S3 bucket), with the root location of the
      build within that medium.
    */

    if (prefix.length > global_path.length)
      throw TypeError("Global path cannot be shorter than prefix");

    const prefix_index = path.indexOf(prefix);

    if (prefix_index === -1)
      throw TypeError(`Prefix not found: ${prefix}`);

    const localized = path.slice(prefix_index + prefix.length);
    return localized;
  }

  async content () {
    return await this.__content;
  }

  async setContent (new_content) {
    this.__content  = new_content;
    this.__hash     = null;
    this.modified   = false;
  }

  async read () {
    return await this.content();
  }

  async write (content = null) {
    this.setContent(content ?? this.__content);
    this.modified = false;
    return this.__content;
  }

  async hash () {
    if (this.__hash)
      return this.__hash;

    const content = await this.content();
    return this.__hash = Crypto.createHash('md5').update(content).digest('hex');
  }
}


export class StaticSiteFileLocal extends StaticSiteFile {
  constructor (locator, key, object={}) {
    // Normalize paths
    locator = Path.resolve(locator);

    const locator_prefix = object.locator_prefix ?? locator.slice(
        0, -key.length
      );

    if ( locator_prefix && !locator.startsWith(locator_prefix) ) {
      throw new TypeError("locator does not start with locator_prefix");
    }

    super({
      ...object,
      locator,
      key,
      locator_prefix,
    });
  }

  async content () {
    if (this.__content === null) {
      this.__content = Fs.promises.readFile(this.locator);
    }
    return await this.__content;
  }

  async write(content = null) {
    content = await super.write(content);
    await Fs.promises.writeFile(this.resource_path, content);
    return content;
  }

  static async * fromWalkDirectoryIter (locator_prefix, key_directory="") {
    /*
      Recursive async generator for walking static site directories.

      The directory becomes the locator_prefix of the StaticSiteFileLocal objects.
      The key_directory accumulates directories within the build, as the method recurses
    */

    // Normalize paths into absolutes with trailing slashes, and assert we're
    // looking at a directory

    locator_prefix = Path.resolve(locator_prefix);
    if (locator_prefix.at(-1) !== "/") {
      locator_prefix += "/";
    }
    if (! (await Fs.promises.lstat(locator_prefix)).isDirectory()) {
      throw new TypeError(`Expected directory: ${locator_prefix}`);
    }

    // Walk files and directories

    for await (let dirent of await Fs.promises.opendir(locator_prefix + key_directory)) {
      let path = dirent.path + dirent.name;
      if (dirent.isDirectory()) {
        yield * StaticSiteFileLocal.fromWalkDirectoryIter(
          locator_prefix,
          `${key_directory}${dirent.name}/`
        );
      }
      else {
        yield new StaticSiteFileLocal(path, key_directory + dirent.name);
      }
    }
  }

  static async fromWalkDirectory (locator_prefix, key_directory="") {
    let files = [];
    for await (let file of StaticSiteFileLocal.fromWalkDirectoryIter(locator_prefix, key_directory)) {
      files.push(file);
    }
    return files;
  }
}


export class StaticSiteFileS3 extends StaticSiteFile {
  constructor (s3_client, aws_object={}, file_object={}) {
    let hash;
    if (aws_object.Hash) {
      const hash_match = object.ETag.match(ETAG_MD5_RGX);

      if (hash_match === null) {
        throw TypeError(`Could not find an MD5 hash in ETag: ${hash_match.ETag}`);
      }
    }
    else {
      hash = file_object.hash ?? null;
    }

    super({
      ...file_object,
      hash,
      locator: aws_object.Key ?? file_object.key,
    });

    const bucket = aws_object.Bucket || aws_object.bucket;
    if (!bucket)
      throw TypeError("Bucket isn't truthy");
    this.bucket = aws_object.Bucket;
    this.s3_client = s3_client;
  }

  async content () {
    if (this.__content == null) {
      this.__content = (async () => {
        // Arrow function used to preserve `this`
        const download_result = await this.s3_client.send(
          new GetObjectCommand({ Bucket: this.bucket, Key: this.locator })
          );
        return await download_result.Body.transformToString();
      })();
    }

    return await this.__content;
  }

  static async fromListObjectsV2Command (s3_client, Bucket, Prefix="", aws_options={}) {
    // Query and filter for static site files in the S3 bucket

    const results = await s3_client.send(
      new ListObjectsV2Command({
        Bucket,
        Prefix,
        ...aws_options
      })
    );

    const objects = results.Contents;

    return StaticSiteFileS3.fromListObjectResults(s3_client, Bucket, objects, Prefix);
  }

  static fromListObjectResults (s3_client, Bucket, objects, prefix="") {
    const ssg_files = new Array(objects.length);

    for (let i in objects) {
      const object = objects[i];
      ssg_files[i] = new StaticSiteFileS3(
        s3_client,
        { Bucket, ...object },
        { key: object.Key.slice(prefix.length),
          locator_prefix: prefix,
        }
      );
    }

    return ssg_files;
  }
}

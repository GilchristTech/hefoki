export function parseBoolean (value, default_value=false) {
  /*
    Get a boolean from a Javascript object or a string from somewhere else.

    Return whether a value is truthy or falsey, with exceptions for strings of
    "false" and "0", and deferring to a default when nullish values are
    encountered.
  */

  if (typeof value === "string") {
    value = value.trim().toLowerCase();
    if (value === "false")
      return false;

    if (value === "0")
      return false;

    return true;
  }

  return Boolean(value ?? default_value)
}


export async function uploadFilesToS3 (static_pages, options={}) {
  /*
    Given a dict of static pages, where their indexes are object keys, and the
    values are the page content, upload each as an object to S3.
  */

  const Bucket = options.Bucket ??     BUCKET;
  const Region = options.Region ?? AWS_REGION;

  const s3_client      = options.s3_client ?? new S3Client({ Region });
  const domain         = options.domain || DEFAULT_DOMAIN;
  const invalidate     = options.invalidate ?? true;

  const upload_promises = Object.entries(static_pages).map(async ([Key, Body]) => {
    console.log(`put: ${Bucket}/${Key} (${(Body.length/1024).toFixed(1)}kb)`);
    const ContentType = Mime.lookup(Key);
    return await s3_client.send(
      new PutObjectCommand({ Bucket, Key, Body, ContentType })
    );
  });

  const results = {};

  results.upload = await Promise.all(upload_promises);

  if ( ! invalidate ) {
    results.invalidation = null;
    return results;
  }

  console.log("Starting CloudFront invalidation");

  let cloudfront_client   = options.cloudfront_client ?? new CloudFront({ Region });
  const invalidation_urls = Object.keys(static_pages).map(key => "/" + key);
  let DistributionId      = ( options.distribution_id || options.DistributionId );

  if ( ! DistributionId ) {
    console.log("Looking for distribution DistributionId...");
    DistributionId = await getCloudfrontDistributionId(cloudfront_client, domain);
  }

  console.log("Performing invalidation on CloudFront distribution with ID:", DistributionId);
  console.log("Invalidation URLs:\n  " + invalidation_urls.join("\n  "));

  results.invalidation = cloudfront_client.createInvalidation({
    DistributionId,
    InvalidationBatch: {
      CallerReference: Date.now().toString(),
      Paths: {
        Quantity: invalidation_urls.length,
        Items:    invalidation_urls
      }
    }
  });

  return results;
}


export async function getCloudfrontDistributionId (client=null, domain=null) {
  domain ||= DEFAULT_DOMAIN;
  client ??= new CloudFront();
  const result = await client.listDistributions({});

  for (let distribution of result.DistributionList.Items) {
    if (distribution?.Aliases?.Items?.includes(domain))
      return distribution.Id;
  }

  throw new Error(`Couldn't find CloudFront distribution with domain: ${domain}`);
}

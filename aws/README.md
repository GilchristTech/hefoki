# Hefoki AWS

Hefoki is deployed on AWS. Here, scripts are defined for managing some of these
resources. Currently, other resources have been set up manually, and are not
defined in code.

## Prerequisites

Before using any of these scripts, make sure you have the following:

- The AWS CLI installed and configured with the necessary credentials.
- Boto3 for Python installed.

## Resources

The following AWS resources have been manually created, but may be later
managed by CloudFormation stacks. The list is not comprehensive; some items,
especially those created by CloudFormation stacks, may not be specified.

| Resource                   | Id                | Description                          |
|----------------------------|-------------------|--------------------------------------|
| `DynamoDB::Table`          | `HefokiHeadlines` | Created by `make-headlines-table.sh` |
| `S3::Bucket`               | `hefoki`          | Manually created.                    |
| `S3::Bucket`               | `hefoki-public`   | Manually created.                    |
| `CloudFront::Distribution` | n/a               | Manually created. Scripts can filter for an alternative domain, the ID can be provided. |

## Site Updater Lambda

Headlines are kept track of and the site is rebuilt by a Lambda function
whose code is in the 
[backend module](https://github.com/GilchristTech/hefoki/tree/master/hefoki-backend).
Here, a command-line script is used to manage the function's code, as well as
wrapping the functions of a CloudFormation stack which define the function, its
permissions, and its EventBridge schedule for periodic execution.

The management script's only Python dependency is `boto3`, and otherwise
requires `zip` and `npm` to be installed on the host system.

## Scripts
### `make-headlines-table.sh`

Currently, the `make-headlines-table.sh` script can be used to create a
headlines table, `HefokiHeadlines`. This should be changed to a CloudFormation
template.

### `invalidate.sh`: CloudFront Invalidation Script

This script if for creating quick invalidation requests for the static site's
CloudFront distribution. The static assets of the site may be properly stored
in the site's S3 bucket, but the CloudFront distribution may be serving
different, older content to users. Invalidation requests refresh the cached
content, keeping it current.

By default, running `invalidate.sh` with no arguments will look for the
distribution pointing to `hefoki.today` and invalidate every URL route.

The script will also wait for the invalidation to complete, helping determine
whether the invalidation is still occurring.

#### Usage

- `--domain`: Specify the alternative domain for which you want to find the
  associated CloudFront distribution. If not provided, it defaults to the value
  of the `ALTERNATIVE_DOMAIN` or `DOMAIN` environment variables, falling back
  to "hefoki.today" if not set.
- Path(s) to invalidate: Specify one or more paths to invalidate. If not
  provided, the script defaults to invalidating all paths (`'/*'`).

#### Example

```bash
./invalidate.sh --domain mydomain.com /path/to/invalidate /another/path
```

In this example, the script will search for a CloudFront distribution
associated with the alternative domain "mydomain.com" and create an
invalidation for the specified paths.

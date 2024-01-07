# Hefoki AWS

Hefoki is deployed on AWS. Here, scripts are defined for managing some of these
resources. Currently, other resources have been set up manually, and are not
defined in code.

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

## DynamoDB Table

Currently, the `make-headlines-table.sh` script can be used to create a
headlines table, `HefokiHeadlines`. This should be changed to a CloudFormation
template.

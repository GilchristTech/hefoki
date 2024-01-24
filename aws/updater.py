#!/bin/env python3

import boto3
import argparse
import os, sys
import shutil
import subprocess

import time
import datetime as dt


def dictCoalesce (dict, default, *keys):
  for key in keys:
    if key in dict:
      return val
  return default

DOMAIN = dictCoalesce(os.environ, "hefoki.today", "HEFOKI_DOMAIN", "CLOUDFRONT_ALTERNATIVE_DOMAIN", "DOMAIN")


def normalizeParameters (parameters):
  if isinstance(parameters, dict):
    return [
        {"ParameterKey": key, "ParameterValue": value}
        for key, value in parameters.items()
        if value is not None
      ]

  return parameters


def monitorStackUntil (
    stack_name,
    action          = None,
    start_time      = None,
    client          = None,
    cancel_callback = None,
    event_timeout   = None,
  ):

  client          = boto3.client("cloudformation")
  last_event_time = start_time or dt.datetime.now()
  events          = []
  failed          = False

  # Coerce for "aware" UTC datetimes
  if last_event_time.tzinfo is None:
    last_event_time = last_event_time.astimezone(dt.timezone.utc)

  if action not in ('create', 'update', 'delete'):
    raise ValueError('Action not one of the following strings: "create", "update", or "delete"')

  while True:
    event_timedelta = dt.datetime.now(dt.timezone.utc) - last_event_time
    if event_timeout and event_timedelta > dt.timedelta(seconds=event_timeout):
      raise TimeoutError(f"Monitoring stack, and received no updates for {event_timeout} seconds")

    response = client.describe_stack_events(StackName = stack_name)
    events   = events + response['StackEvents']

    for event in reversed(response['StackEvents']):
      if last_event_time and event['Timestamp'] <= last_event_time:
        continue

      last_event_time = event["Timestamp"]
      print(f"{event['Timestamp']}\t{event['ResourceStatus'].ljust(24)}\t{event['LogicalResourceId']}")

      resource_status = event['ResourceStatus']

      if resource_status.endswith("_FAILED"):
        failed = True
        print(event["ResourceStatusReason"])

      if cancel_callback:
        if cancel_callback(event):
          return events

      if event['LogicalResourceId'] != stack_name or not action:
        continue

      if not resource_status.startswith(action.upper()):
        continue

      if resource_status.endswith("_COMPLETE") or resource_status.endswith("_FAILED"):
        if failed:
          raise Exception("Stack action failed")
        return events

    time.sleep(0.5)


def waitForStackCompletion (stack_name, action, cf_client=None):
  cf_client = cf_client or boto3.client("cloudformation")
  waiter    = cf_client.get_waiter(action)
  try:
    waiter.wait(StackName=stack_name)
  except Exception as e:
    print(f"Error during {action} operation: {e}")


def createStack (stack_name, template_path, parameters, cf_client=None):
  print("Creating stack...")
  parameters = normalizeParameters(parameters)
  cf_client  = cf_client or boto3.client("cloudformation")
  response = cf_client.create_stack(
    StackName    = stack_name,
    TemplateBody = open(template_path).read(),
    Parameters   = parameters,
    Capabilities = ["CAPABILITY_IAM", "CAPABILITY_NAMED_IAM"],
  )
  return response


def updateStack (stack_name, template_path, parameters, cf_client=None):
  print("Updating stack...")
  parameters = normalizeParameters(parameters)
  cf_client  = cf_client or boto3.client("cloudformation")
  response = cf_client.update_stack(
    StackName    = stack_name,
    TemplateBody = open(template_path).read(),
    Parameters   = parameters,
    Capabilities = ["CAPABILITY_IAM", "CAPABILITY_NAMED_IAM"],
  )
  return response


def deleteStack (stack_name, client=None):
  print("Deleting stack...")
  client   = client or boto3.client("cloudformation")
  response = client.delete_stack(StackName=stack_name)
  return response


def handleStack (args):
  client        = args.client if "client" in args else boto3.client("cloudformation")
  action        = args.action
  stack_name    = args.stack_name
  template_path = args.template_path
  parameters    = args.parameters if "parameters" in args else {}
  domain        = args.domain     if "domain"     in args else DOMAIN

  parameters = dict(parameters)  # shallow copy

  # If the CloudFront distribution hasn't been defined, search for it
  #
  if parameters.get('CloudFrontDistributionArn') is None:
    distribution = getCloudFrontDistribution()
    if not distribution:
      print(f"Could not find CloudFront distribution with alternative domain: {domain}", file=error)
      sys.exit(1)
    parameters['CloudFrontDistributionArn'] = distribution['ARN']

  # Choose the appropriate stack action, run, and wait for completion
  # TODO: error handling and shell exit codes

  start_time = dt.datetime.now()

  match action:
    case "create":
      response = createStack(stack_name, template_path, parameters, client)
      monitorStackUntil(stack_name, "create", start_time=start_time, client=client)
      # waitForStackCompletion(stack_name, "stack_create_complete", client)
      # waitForStackCompletion(stack_name, "stack_exists", client)
    case "update":
      response = updateStack(stack_name, template_path, parameters, client)
      monitorStackUntil(stack_name, "update", start_time=start_time, client=client)
      # waitForStackCompletion(stack_name, "stack_update_complete", client)
    case "delete":
      response = deleteStack(stack_name, client)
      monitorStackUntil(stack_name, "delete", start_time=start_time, client=client)
      # waitForStackCompletion(stack_name, "stack_delete_complete", client)
    case "monitor":
      try:
        monitorStackUntil(stack_name, client=client)
      except KeyboardInterrupt:
        sys.exit(0)
    case _:
      raise ValueError(f'Error: stack action was not "create", "update", or "delete", got {args.action} instead')

  # print(response)
  # print(f"StackId: {response['StackId']}")


def handleLambda (args):
  build_dir    = os.path.join("build", "updater")
  package_path = os.path.join(build_dir, "package.zip")

  if args.build:
    print("Building package")
    os.makedirs(build_dir, exist_ok=True)
    dst = build_dir
    src = os.path.join("../", "hefoki-backend")

    shutil.copy(
        os.path.join(src, "package.json"),
        os.path.join(dst, "package.json")
      )

    shutil.copy(
        os.path.join(src, "package-lock.json"),
        os.path.join(dst, "package-lock.json")
      )

    dst_src_path = os.path.join(dst, "src")
    if os.path.exists(dst_src_path):
      shutil.rmtree(dst_src_path)

    shutil.copytree(
        os.path.join(src, "src"),
        dst_src_path
      )

    if os.path.exists(package_path):
      os.remove(package_path)

    print("> npm ci")
    build_process = subprocess.Popen("npm ci".split(), cwd=dst)
    out, err = build_process.communicate()
    if err or build_process.returncode:
      print(f"Build process failed with exit code: {build_process.returncode}", file=sys.stderr)
      sys.exit(build_process.returncode)

    print("> zip -9 -r package.zip .")
    zip_process = subprocess.Popen("zip -9 -r package.zip .".split(), cwd=dst)
    out, err = zip_process.communicate()
    if err or zip_process.returncode:
      print(f"Zip failed with exit code: {build_process.returncode}", file=sys.stderr)
      sys.exit(build_process.returncode)
    print("Build complete")

  if args.put:
    print("Uploading package.zip to S3")
    if not os.path.exists(package_path):
      print("Error: could not find package.zip", file=sys.stderr)
      sys.exit(1)

    s3_client = boto3.client("s3")
    with open(package_path, "rb") as fd:
      put_response = s3_client.put_object(Bucket="hefoki", Key="packages/updater.zip", Body=fd)

  if args.update:
    print("Updating Lambda function code")
    lambda_client = boto3.client("lambda")
    lambda_client.update_function_code(
        FunctionName = "hefoki-updater",
        S3Bucket     = "hefoki",
        S3Key        = "packages/updater.zip"
      )

  if args.invoke:
    import json
    lambda_client = boto3.client("lambda")

    response = lambda_client.invoke(
        FunctionName   = "hefoki-updater",
        InvocationType = "RequestResponse",
      )

    print(response)
    print()
    response_body = response['Payload'].read().decode('utf-8')
    response_json = json.loads(response_body)
    with open("file.json", "w") as fd:
      json.dump(response_json, fd)

    error = False
    if 'errorType' in response_json:
      print(f"{ response_json['errorType'] }: { response.json.get('errorMessage', '') }")
      error = True

    print(json.loads(response_json))
    print(json.dumps(response_json, indent=2))

    if error:
      sys.exit(1)


def getCloudFrontDistribution(domain_name="hefoki.today"):
    """
    Searches for a CloudFront distribution with the specified alternative domain name.

    Parameters:
    - domain_name (str): The alternative domain name to search for. Default: "hefoki.today"

    Returns:
    - dict: Information about the CloudFront distribution if found, None otherwise.
    """

    # List all CloudFront distributions, then iterate over them to find the one
    # with the specified domain name

    cloudfront_client = boto3.client('cloudfront')
    distributions     = cloudfront_client.list_distributions()

    for distribution in distributions['DistributionList']['Items']:
        aliases = distribution.get('Aliases', {'Items': []}).get('Items', [])
        if domain_name in aliases:
            return distribution

    return None


def main (args=None):
  parser = argparse.ArgumentParser(
      description = "Manage CloudFormation stack for updater"
    )

  subparsers    = parser.add_subparsers(required=True)
  stack_parser  = subparsers.add_parser("stack")
  lambda_parser = subparsers.add_parser("lambda")

  stack_parser.add_argument(
      "action",
      choices  = ["create", "update", "delete", "monitor"],
      help     = "Action to perform on the CloudFormation stack"
    )

  parameters = dict(
      UpdaterLambdaFunctionName = None,
      UpdaterInterval           = None,
      UpdaterLambdaS3Bucket     = None,
      UpdaterLambdaS3Key        = None,
      CloudFrontDistributionArn = None
    )

  stack_parser.set_defaults(
        func             = handleStack,
        template_path    = "./updater.cf.yaml",
        stack_name       = "HefokiUpdater",
        stack_parameters = parameters
      )

  lambda_parser.add_argument("-b", "--build",  action="store_true")
  lambda_parser.add_argument("-p", "--put",    action="store_true")
  lambda_parser.add_argument("-u", "--update", action="store_true")
  lambda_parser.add_argument("-i", "--invoke", action="store_true")

  lambda_parser.set_defaults(
      func = handleLambda
    )

  parsed_args = parser.parse_args(args)
  if "func" in parsed_args:
    parsed_args.func(parsed_args)


if __name__ == "__main__":
  main()

#!/bin/bash
set -e

ALTERNATIVE_DOMAIN=${ALTERNATIVE_DOMAIN:-${DOMAIN:-"hefoki.today"}}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      ALTERNATIVE_DOMAIN="$2"
      shift 2
      ;;
    *)
      INVALIDATION_PATHS+=("$1")
      shift
      ;;
  esac
done

# By default, the invalidation should target all paths
INVALIDATION_PATHS=${INVALIDATION_PATHS:-'/*'}

# Search for CloudFront distribution by alternative domain
echo "Searching for domain with an alternative domain of ${ALTERNATIVE_DOMAIN}"
DISTRIBUTION_ID=$( \
    aws cloudfront list-distributions \
    --query "DistributionList.Items[?Aliases.Items[0]=='$ALTERNATIVE_DOMAIN'].Id" \
    --output text \
)

if [ -z "$DISTRIBUTION_ID" ]; then
  echo "CloudFront distribution with alternative domain ${ALTERNATIVE_DOMAIN} not found."
  exit 1
else
  echo "CloudFront distribution found with ID: $DISTRIBUTION_ID"
fi

echo
echo "Invalidation paths:"
for INVALIDATION_PATH in "${INVALIDATION_PATHS[@]}"; do
  echo "  ${INVALIDATION_PATH}"
done

echo
echo "Creating invalidation"

# Perform the invalidation and get the ID
INVALIDATION_ID=$( \
    aws cloudfront create-invalidation \
      --distribution-id "${DISTRIBUTION_ID}" \
      --paths "${INVALIDATION_PATHS[@]}" \
      --query "Invalidation.Id" --output text \
)

echo "InvalidationId: ${INVALIDATION_ID}"

echo "Invalidation request sent for CloudFront distribution"
echo "Waiting for invalidation completion..."
aws cloudfront wait invalidation-completed --distribution-id "$DISTRIBUTION_ID" --id "$INVALIDATION_ID"

#!/bin/bash

aws dynamodb create-table \
  --table-name HefokiHeadlines \
  --key-schema \
      AttributeName=Date,KeyType=HASH \
  --attribute-definitions \
      AttributeName=Date,AttributeType=S \
  --provisioned-throughput \
      ReadCapacityUnits=1,WriteCapacityUnits=1 \

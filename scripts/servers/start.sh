#!/usr/bin/env bash

# Prepare directories
mkdir -p ~/redis/redisData

docker-compose -f $PWD/scripts/servers/docker-compose.yml down
docker-compose -f $PWD/scripts/servers/docker-compose.yml up

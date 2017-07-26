#!/bin/bash
echo "Start Kafka broker for logagent test"
export KAFKA_ADVERTISED_HOST_NAME=127.0.0.1
BASEDIR=$(pwd)/kafka-test
docker-compose -f $BASEDIR/docker-compose.yml up -d

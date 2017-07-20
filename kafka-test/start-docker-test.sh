#!/bin/bash
echo "Start Kafka broker for logagent test"
export KAFKA_ADVERTISED_HOST_NAME=127.0.0.1
docker-compose -f docker-compose.yml up -d

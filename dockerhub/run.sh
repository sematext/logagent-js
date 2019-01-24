#!/bin/bash

# check docker secrets volume 
export CONFIG_FILE=${CONFIG_FILE:-/run/secrets/logagent}
set -o allexport
if [ -f "$CONFIG_FILE" ]
then
  echo "Reading configuration from file: ${CONFIG_FILE}"
  source $CONFIG_FILE
fi


if [[ -z "$APP_ROOT" ]]; then
  export PATTERN_DIR=/etc/logagent
else
  export PATTERN_DIR=${APP_ROOT}
fi

if [[ -z "$APP_ROOT" ]]; then
  export LA_CONFIG=/etc/sematext/logagent.conf
else
  export LA_CONFIG=${APP_ROOT}/logagent.conf}
fi

export MAX_CLIENT_SOCKETS=${MAX_CLIENT_SOCKETS:-1}
export LOGSENE_ENABLED_DEFAULT=${LOGSENE_ENABLED_DEFAULT:-true}
export RECEIVERS_CONFIG="/etc/sematext/receivers.config"
export LOGSENE_TMP_DIR=/log-buffer
mkdir -p $LOGSENE_TMP_DIR

# be backward compatible
export LOGSENE_RECEIVER_URL
if [[ -z "$LOGSENE_RECEIVER_URL" ]]; then
  export LOGSENE_RECEIVER_URL="$LOGS_RECEIVER_URL"
fi

if [[ -z "$LOGS_TOKEN" ]]; then
  export LOGS_TOKEN="$LOGSENE_TOKEN"
fi

if [[ -z "$LOGS_TOKEN" ]]; then
  export LOGS_TOKEN="$LOG_INDEX"
fi


if [[ -z "$LOGS_TOKEN" ]]; then
  echo "You need to set the LOGS_TOKEN in the environment!" >&2
  exit 1
fi

if [[ ! -r /var/run/docker.sock ]]; then
  if [[ -z "$LOG_GLOB" ]]; then
    echo "You need to specify a log source. Mount the docker socket or set the LOG_GLOB in the environment!" >&2
  fi
else
  export LOGAGENT_ARGS="--docker /var/run/docker.sock ${LOGAGENT_ARGS}"
fi

# Support custom patterns for Logagent
if [ -n "${PATTERNS_URL}" ]; then
  # Logagent will fetch the patterns file via HTTP
  mkdir -p $PATTERN_DIR
fi

if [ -n "${LOGAGENT_PATTERNS}" ]; then
  if [ "${LOGAGENT_PATTERNS_BASE64}" == "true" ]; then
    # If the logagent patterns file is an environment variable, and base64 encoded
    mkdir -p $PATTERN_DIR
    echo "writing LOGAGENT_PATTERNS to ${PATTERN_DIR}/patterns.yml"
    echo "$LOGAGENT_PATTERNS" | base64 -d > $PATTERN_DIR/patterns.yml
  else
    mkdir -p $PATTERN_DIR
    echo "writing LOGAGENT_PATTERNS to ${PATTERN_DIR}/patterns.yml"
    echo "$LOGAGENT_PATTERNS" > ${PATTERN_DIR}/patterns.yml
  fi
fi


echo "Preparing environment..."

touch $LA_CONFIG

generate_config() {
  if [[ ! -z "$LOGSENE_RECEIVER_URL" ]]; then
    echo -e "SPM_RECEIVER_URL=$SPM_RECEIVER_URL
EVENTS_RECEIVER_URL=$EVENTS_RECEIVER_URL
LOGSENE_RECEIVER_URL=$LOGSENE_RECEIVER_URL" >"$RECEIVERS_CONFIG"
    REGION="custom"
  fi

  if [[ $REGION == "US" ]]; then
    echo -e "SPM_RECEIVER_URL=https://spm-receiver.sematext.com/receiver/v1
EVENTS_RECEIVER_URL=https://event-receiver.sematext.com
LOGSENE_RECEIVER_URL=https://logsene-receiver.sematext.com" >"$RECEIVERS_CONFIG"
  fi

  if [[ $REGION == "EU" ]]; then
    echo -e "SPM_RECEIVER_URL=https://spm-receiver.eu.sematext.com/receiver/v1
EVENTS_RECEIVER_URL=https://event-receiver.eu.sematext.com
LOGSENE_RECEIVER_URL=https://logsene-receiver.eu.sematext.com" >"$RECEIVERS_CONFIG"
  fi

  LOGSENE_RECEIVER_URL=$(grep -w LOGSENE_RECEIVER_URL "$RECEIVERS_CONFIG" | sed 's/\(LOGSENE_RECEIVER_URL=\)\(.*\)/\2/')

  # echo "Receivers config from $RECEIVERS_CONFIG:"
  # cat "$RECEIVERS_CONFIG"
}

generate_config

cat >$LA_CONFIG <<EOF
options:
  printStats: 60
  suppress: true
  geoipEnabled: true
  diskBufferDir: /tmp/sematext-logagent
parser:
  patternFiles:
    - ${PATTERN_DIR}/patterns.yml
EOF

echo "$LOG_GLOB"
if [ "${LOG_GLOB}" ]; then 
cat >>$LA_CONFIG <<EOF
input:
  files:
EOF

  while IFS=';' read -ra ADDR; do
    for i in "${ADDR[@]}"; do
      echo "    - ${i}" >>$LA_CONFIG
    done
  done <<<"$LOG_GLOB"
fi

# if [ -r /var/run/docker.sock ]; then
# cat >>$LA_CONFIG <<EOF
#   dockerLogs:
#     module: docker-logs
#     labelFilter: .*

# outputFilter:
#   - module: docker-enrichment
#     config:
#       autodetectSeverity: true
# EOF
# fi

cat >>$LA_CONFIG <<EOF
output:
  logsene:
    module: elasticsearch
    url: $LOGSENE_RECEIVER_URL
    index: ${LOGS_TOKEN}
EOF

echo "Content of ${LA_CONFIG}:"
cat $LA_CONFIG

echo "logagent -c $LA_CONFIG ${LOGAGENT_ARGS}"
exec logagent -c $LA_CONFIG ${LOGAGENT_ARGS}


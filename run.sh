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

if [[ -z "$LA_CONFIG" ]]; then
  if [[ -z "$APP_ROOT" ]]; then
    export LA_CONFIG=/etc/sematext/logagent.conf
  else
    export LA_CONFIG=${APP_ROOT}/logagent.conf}
  fi
  export GENERATE_CONFIG_FILE="true"
fi

echo $LA_CONFIG 

export MAX_CLIENT_SOCKETS=${MAX_CLIENT_SOCKETS:-5}

# Set both values to be default TRUE
# Check in the code if they are both TRUE
# If they are not both TRUE, because user sets at
# least one of them to FALSE, the env will view 
# them as FALSE
export LOGSENE_ENABLED_DEFAULT=${LOGSENE_ENABLED_DEFAULT:-true}
export LOGS_ENABLED_DEFAULT=${LOGS_ENABLED_DEFAULT:-true}

export LOGSENE_TMP_DIR=/log-buffer
mkdir -p $LOGSENE_TMP_DIR
export LA_CONFIG_OVERRIDE=${LA_CONFIG_OVERRIDE:-false}

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
  if [ "${LA_CONFIG_OVERRIDE}" != "true" ]; then
    echo "You need to set the LOGS_TOKEN in the environment!" >&2
    exit 1
  fi
  echo "You have selected to override the token configuration in your ${LA_CONFIG}!" >&2
fi


if [[ -n "${JOURNALD_UPLOAD_PORT}" ]]; then
  # enable journald log collection
  export LOGAGENT_ARGS="--journald {JOURNALD_UPLOAD_PORT} ${LOGAGENT_ARGS}"  
fi

if [[ -z "$LOG_GLOB" ]]; then
  echo "You need to specify a log source. Mount the docker socket or set the LOG_GLOB in the environment!" >&2
fi

if [[ -n "${KUBERNETES_SERVICE_HOST}" ]]; then
    # K8S env -> use k8sEnrichment plugin
    export LOGAGENT_ARGS="--k8sEnrichment ${LOGAGENT_ARGS}"  
fi

if [[ ! -r /var/run/docker.sock ]]; then
  # no docker socket
  if [[ -n "${KUBERNETES_SERVICE_HOST}" ]]; then
    # no docker socket & K8S env -> use containerd plugin
    export LOGAGENT_ARGS="--k8sContainerd ${LOGAGENT_ARGS}"  
  fi

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
    export LOGSENE_RECEIVER_URL=$LOGSENE_RECEIVER_URL
    export REGION="custom"
  fi

  if [[ $REGION == "US" ]]; then
    export LOGSENE_RECEIVER_URL="https://logsene-receiver.sematext.com"
  fi

  if [[ $REGION == "EU" ]]; then
    export LOGSENE_RECEIVER_URL="https://logsene-receiver.eu.sematext.com"
  fi
  echo "Log receiver url: $LOGSENE_RECEIVER_URL"
}

generate_config

if [[ -n "${GENERATE_CONFIG_FILE}" ]]; then
echo "Creating Logagent config file: $LA_CONFIG"
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
cat >>$LA_CONFIG <<EOF
  logagentMonitor:
    module: '@sematext/logagent-nodejs-monitor'
EOF
else
cat >>$LA_CONFIG <<EOF

input: 
  logagentMonitor:
    module: '@sematext/logagent-nodejs-monitor'

EOF
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

fi

echo "Content of ${LA_CONFIG}:"
cat $LA_CONFIG

echo "/bin/logagent.js -c $LA_CONFIG ${LOGAGENT_ARGS}"
exec /bin/logagent.js -c $LA_CONFIG ${LOGAGENT_ARGS}


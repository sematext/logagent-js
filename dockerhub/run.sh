#!/bin/bash

export LOGSENE_RECEIVER_URL
export RECEIVERS_CONFIG="/etc/sematext/receivers.config"

# be backward compatible
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
  echo "You need to set the LOG_INDEX or LOGSENE_TOKEN in the environment!" >&2
  exit 1
fi

if [[ ! -r /var/run/docker.sock ]]; then
  if [[ -z "$LOG_GLOB" ]]; then
    echo "You need to set the LOG_GLOB in the environment!" >&2
    exit 1
  fi
else
  export LOGAGENT_ARGS="--docker /var/run/docker.sock ${LOGAGENT_ARGS}"
fi

if [ -n "${PATTERNS_URL}" ]; then
  # Logagent will fetch the patterns file via HTTP
  mkdir -p /etc/logagent
fi

if [ -n "${LOGAGENT_PATTERNS}" ]; then
  if [ "${LOGAGENT_PATTERNS_BASE64}" == "true" ]; then
    # If the logagent patterns file is an environment variable, and base64 encoded
    mkdir -p /etc/logagent
    echo "writing LOGAGENT_PATTERNS to /etc/logagent/patterns.yml"
    echo "$LOGAGENT_PATTERNS" | base64 -d > /etc/logagent/patterns.yml
  else
    mkdir -p /etc/logagent
    echo "writing LOGAGENT_PATTERNS to /etc/logagent/patterns.yml"
    echo "$LOGAGENT_PATTERNS" > /etc/logagent/patterns.yml
  fi
fi


echo "Preparing environment..."

touch /etc/sematext/logagent.conf
chmod 600 /etc/sematext/logagent.conf

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

cat >/etc/sematext/logagent.conf <<EOF
options:
  printStats: 60
  suppress: true
  geoipEnabled: true
  diskBufferDir: /tmp/sematext-logagent
parser:
  patternFiles:
    - /opt/logagent/patterns.yml
    - /etc/logagent/patterns.yml
EOF

echo "$LOG_GLOB"
if [ "${LOG_GLOB}" ]; then 
cat >>/etc/sematext/logagent.conf <<EOF
input:
  files:
EOF

  while IFS=';' read -ra ADDR; do
    for i in "${ADDR[@]}"; do
      echo "    - ${i}" >>/etc/sematext/logagent.conf
    done
  done <<<"$LOG_GLOB"
fi

# if [ -r /var/run/docker.sock ]; then
# cat >>/etc/sematext/logagent.conf <<EOF
#   dockerLogs:
#     module: docker-logs
#     labelFilter: .*

# outputFilter:
#   - module: docker-enrichment
#     config:
#       autodetectSeverity: true
# EOF
# fi

cat >>/etc/sematext/logagent.conf <<EOF
output:
  logsene:
    module: elasticsearch
    url: $LOGSENE_RECEIVER_URL
    index: ${LOGS_TOKEN}
EOF

echo "Content of /etc/sematext/logagent.conf:"
cat "/etc/sematext/logagent.conf"

echo "/usr/local/bin/logagent -c /etc/sematext/logagent.conf ${LOGAGENT_ARGS}"
exec /usr/local/bin/logagent -c /etc/sematext/logagent.conf ${LOGAGENT_ARGS}
cat /etc/sematext/logagent.conf

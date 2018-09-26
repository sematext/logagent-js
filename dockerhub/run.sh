#!/bin/bash

export LOGSENE_RECEIVER_URL
export RECEIVERS_CONFIG="/etc/sematext/receivers.config"

if [[ -z "$LOG_INDEX" ]]; then
  export LOG_INDEX="$LOGSENE_TOKEN"
fi

if [[ -z "$LOG_INDEX" ]]; then
  echo "You need to set the LOG_INDEX or LOGSENE_TOKEN in the environment!" >&2
  exit 1
fi

if [[ ! -r /var/run/docker.sock ]]; then
  if [[ -z "$LOG_GLOB" ]]; then
    echo "You need to set the LOG_GLOB in the environment!" >&2
    exit 1
  fi
else
  export LA_ARGUMENTS="--docker /var/run/docker.sock ${LA_ARGUMENTS}"
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

  echo "Receivers config from $RECEIVERS_CONFIG:"
  cat "$RECEIVERS_CONFIG"
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
    index: ${LOG_INDEX}
EOF

echo "/usr/local/bin/logagent -c /etc/sematext/logagent.conf ${LA_ARGUMENTS}"
exec /usr/local/bin/logagent -c /etc/sematext/logagent.conf ${LA_ARGUMENTS}
cat /etc/sematext/logagent.conf
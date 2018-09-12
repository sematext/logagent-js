#!/bin/bash

# 
if [[ -z "$LOG_INDEX" ]]; then
  export LOG_INDEX="$LOGSENE_TOKEN"
fi 

if [[ -z "$LOG_INDEX" ]]; then
    echo "You need to set the LOG_INDEX or LOGSENE_TOKEN in the environment!" >&2
    exit 1
fi

if [ ! -r /var/run/docker.sock ]; then
  export LA_ARGUMENTS="${LA_ARGUMENTS} --docker /var/run/docker.sock"
  if [[ -z "$LOG_GLOB" ]]; then
    echo "You need to set the LOG_GLOB in the environment!" >&2
    exit 1
  fi
fi

echo "Preparing environment..."

touch /etc/sematext/logagent.conf
chmod 600 /etc/sematext/logagent.conf

# Set US receiver as default
export LOGSENE_RECEIVER_URL="https://logsene-receiver.sematext.com"
function generate_eu_config()
{
echo -e "SPM_RECEIVER_URL=https://spm-receiver.eu.sematext.com/receiver/v1
EVENTS_RECEIVER_URL=https://event-receiver.eu.sematext.com
LOGSENE_RECEIVER_URL=https://logsene-receiver.eu.sematext.com" > /etc/sematext/receivers.config
export LOGSENE_RECEIVER_URL="https://logsene-receiver.eu.sematext.com"
}

function generate_us_config()
{
echo -e "SPM_RECEIVER_URL=https://spm-receiver.sematext.com/receiver/v1
EVENTS_RECEIVER_URL=https://event-receiver.sematext.com
LOGSENE_RECEIVER_URL=https://logsene-receiver.sematext.com" > /etc/sematext/receivers.config
export LOGSENE_RECEIVER_URL="https://logsene-receiver.sematext.com"
}

if [ "$REGION" == "EU" ]; then 
  generate_eu_config
  echo "Set region $REGION in /etc/sematext/receivers.config:"
  cat /etc/sematext/receivers.config
fi;
if [ "$REGION" == "US" ]; then 
  generate_us_config
  echo "Set region $REGION in /etc/sematext/receivers.config:"
  cat /etc/sematext/receivers.config
fi;

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

if [[ -z "$LOG_GLOB}" ]]; then
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

exec /usr/local/bin/logagent -c /etc/sematext/logagent.conf ${LA_ARGUMENTS}
cat /etc/sematext/logagent.conf


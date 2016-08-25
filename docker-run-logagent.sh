#!/bin/sh
export NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=512"}
export RTAIL_OPTIONS="-s --rtail-host $HOSTNAME --rtail-web-port 80 --rtail-port 9999"
# default is silent mode, no logs to console
export LOGAGENT_OPTIONS=${LOGAGENT_OPTIONS:-"-s"}
# default pattern file
export PATTERN_FILE=${PATTERN_FILE:-"/src/patterns.yml"}
export LOGSENE_TMP_DIR=/logagent-disk-buffer
mkdir -p $LOGSENE_TMP_DIR
echo "logagent -u 514 --index ${LOGSENE_TOKEN} -p $PATTERN_FILE ${LOGAGENT_OPTIONS}"
logagent -u 514 --index ${LOGSENE_TOKEN} -p $PATTERN_FILE ${LOGAGENT_OPTIONS}
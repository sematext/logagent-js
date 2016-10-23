#!/bin/sh
export NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=512"}
export RTAIL_OPTIONS="-s --rtail-host $HOSTNAME --rtail-web-port 80 --rtail-port 9999"
# default is silent mode, no logs to console
export LOGAGENT_OPTIONS=${LOGAGENT_OPTIONS:-"-s"}
# default pattern file
export PATTERN_FILE=${PATTERN_FILE:-"/src/patterns.yml"}
export LOGSENE_TMP_DIR=${LOGSENE_TMP_DIR:-/logagent-disk-buffer}
mkdir -p $LOGSENE_TMP_DIR
export CMD="logagent -u 514 --index ${LOGSENE_TOKEN} -f $PATTERN_FILE ${LOGAGENT_OPTIONS}"
echo $CMD
$CMD
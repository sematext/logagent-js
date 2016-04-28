#!/bin/sh
export NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=512"}
# default is silent mode, no logs to console
export LOGAGENT_OPTIONS=${LOGAGENT_OPTIONS:-"-s"}
# default pattern file
export PATTERN_FILE=${PATTERN_FILE:-"/src/patterns.yml"}
echo "logagent -u 514 -t ${LOGSENE_TOKEN} -p $PATTERN_FILE ${LOGAGENT_OPTIONS}"
logagent -u 514 -t ${LOGSENE_TOKEN} -p $PATTERN_FILE ${LOGAGENT_OPTIONS}
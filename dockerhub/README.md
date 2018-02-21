
The [Logagent](https://sematext.com/logagent) docker container can be configured through the following environment variables:

* **LOG_URL**: The URL of your Elasticsearch Endpoint _(defaults to https://logsene-receiver.sematext.com)_. 
  - For Sematext Europe use https://logsene-receiver.eu.sematext.com. 
  - For Elasticsearch https://elasticserch-server-name:9200.
* **LOG_INDEX**: The index where the agent should log to _(for sematext users the logs token)_
* **LOG_GLOB**: Semicolon-separated list of file globs _(e.g. /var/log/**/*.log;/my/app/logs/*.log)_
* **LA_ARGUMENTS**: Additional [command line arguments for Logagent](https://sematext.com/docs/logagent/cli-parameters/) _(e.g. LA_ARGUMENTS="-n httpd" to specify a log source name or LA_ARGUMENTS="-u 514" to act as syslog server)_

Run a container:
The following example enables UDP syslog receiver and ships all log files from /var/log to Sematext Cloud (US).
Simply mount the log file directory into Logagent container and provide a glob pattern to match the log files to watch.

```
docker run -d --name logagent \
-v /var/log:/mylogs \
-p 1514:514 \
-e LOG_URL=https://logsene-receiver.sematext.com \
-e LOG_INDEX=YOUR_LOGSENE_TOKEN_HERE \
-e LOG_GLOB="/mylogs/**/.log" \
-e LA_ARGUMENTS="-u 514" \
sematext/logagent
```

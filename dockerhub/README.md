
The [Logagent](https://sematext.com/logagent) docker container can be configured through the following environment variables:
* **REGION**: Sematext Cloud region **US** or **EU** (default: US). The receiver URL will be set to EU/US default values. When using REGION, you don't need to set LOGSENE_RECEIVER_URL (see below).
* **LOGSENE_RECEIVER_URL**: The URL of your Elasticsearch Endpoint _(defaults to Sematext Cloud US https://logsene-receiver.sematext.com)_. 
  - For Sematext Europe use https://logsene-receiver.eu.sematext.com. 
  - For Elasticsearch https://elasticserch-server-name:9200.
* **LOGSENE_TOKEN**: The index where the agent should log to _(for [Sematext Cloud](https://sematext.com/cloud) users the logs token)_
* **LOG_GLOB**: Semicolon-separated list of file globs _(e.g. /var/log/**/*.log;/my/app/logs/*.log)_
* **LA_ARGUMENTS**: Additional [command line arguments for Logagent](https://sematext.com/docs/logagent/cli-parameters/) _(e.g. LA_ARGUMENTS="-n httpd" to specify a log source name or LA_ARGUMENTS="-u 514" to act as syslog server)_
Run a container:
The following example enables UDP syslog receiver and ships all log files from /var/log to Sematext Cloud (US).
Simply mount the log file directory into Logagent container and provide a glob pattern to match the log files to watch.

```
docker run -d --name logagent \
-v /var/log:/mylogs \
-p 1514:514 \
-e LOG_GLOB="/mylogs/**/.log" \
-e LOGSENE_RECEIVER_URL=https://logsene-receiver.sematext.com \
-e LOGSENE_TOKEN=YOUR_LOGSENE_TOKEN_HERE \
-e LA_ARGUMENTS="-u 514" \
sematext/logagent
```

Get the log files from all Docker Swarm nodes: 

```
docker service create --mode global --name logagent \
--mount type=bind,src=/var/log,dst=/mylogs \
-e LOG_GLOB="/mylogs/**/.log" \
-e LOGSENE_TOKEN=YOUR_LOGSENE_TOKEN_HERE \
-e LOGSENE_RECEIVER_URL=https://logsene-receiver.sematext.com  \
sematext/logagent
```

Get the all container logs from all Docker Swarm nodes: 

```
docker service create --mode global --name logagent \
--mount type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock \
-e LOGSENE_TOKEN=YOUR_LOGSENE_TOKEN_HERE \
-e LOGSENE_RECEIVER_URL=https://logsene-receiver.sematext.com  \
sematext/logagent
```

See [Logagent Documentation](https://sematext.com/docs/logagent) for more info.

Note: Please use [sematext/sematext-agent-docker](https://hub.docker.com/r/sematext/sematext-agent-docker/) to collect container logs, host and container metrics and Docker events. Sematext Docker Agent supports log enrichment with all relevant container metadata like Swarm service names, Kubernetes metadata, etc. 

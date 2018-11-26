
The [Logagent](https://sematext.com/logagent) docker container can be configured through the following environment variables:

* **REGION**: Sematext Cloud region **US** or **EU** (default: US). The receiver URL will be set to EU/US default values. When using REGION, you don't need to set LOGS_RECEIVER_URL (see below).
* **LOGS_RECEIVER_URL**: The URL of your Elasticsearch Endpoint _(defaults to Sematext Cloud US https://logsene-receiver.sematext.com)_. 
  - For Sematext Europe use https://logsene-receiver.eu.sematext.com. 
  - For Elasticsearch https://elasticserch-server-name:9200.
* **LOGS_TOKEN**: The index where the agent should log to _(for [Sematext Cloud](https://sematext.com/cloud) users the logs token)_
* **LOG_GLOB**: Semicolon-separated list of file globs __(e.g. /mylogs/**/*.log;/var/log/**/*.log)__. Mount your server log files into the container using a Docker volume e.g. `-v /var/log:/mylogs`. 
* **LOGAGENT_ARGS**: Additional [command line arguments for Logagent](https://sematext.com/docs/logagent/cli-parameters/) _(e.g. LOGAGENT_ARGS="-n httpd" to specify a log source name or LOGAGENT_ARGS="-u 514" to act as syslog server)_. Please refer to Logagent command line argumetns in the [Logagent Documentation](https://sematext.com/docs/logagent/cli-parameters/)

## Collecting Docker logs

To collect container logs mount the Docker socket to collect container logs e.g. `-v /var/run/docker.sock:/var/run/docker.sock`


Run a container:

### Collect all container logs including container meta data: 

```
docker run --name logagent \
-v /var/run/docker.sock:/var/run/docker.sock \
-e LOGS_TOKEN=YOUR_LOGS_TOKEN_HERE \
sematext/logagent
```

### Get all container logs from from all Docker Swarm nodes
```
docker service create --mode global --name logagent \
--mount type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock \
-e LOGS_TOKEN=YOUR_LOGS_TOKEN_HERE \
-e LOGS_RECEIVER_URL=https://logsene-receiver.sematext.com  \
sematext/logagent
```

## Other examples

The following example enables UDP syslog receiver and ships all log files from /var/log to Sematext Cloud (US).
Simply mount the log file directory into Logagent container and provide a glob pattern to match the log files to watch.

```
docker run -d --name logagent \
-v /var/log:/mylogs \
-p 1514:514 \
-e LOG_GLOB="/mylogs/**/.log" \
-e LOGS_RECEIVER_URL=https://logsene-receiver.sematext.com \
-e LOGS_TOKEN=YOUR_LOGS_TOKEN_HERE \
-e LOGAGENT_ARGS="-u 514" \
sematext/logagent
```
## Configuration Parameters


| Parameter / Environment variable                         | Description                                                                                                                                                                                                                                                                                                                                              |
|----------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Required Parameters                                      |                                                                                                                                                                                                                                                                                                                                                          |
| LOGS_TOKEN                                               | Logsene Application Token enables logging to Logsene, see logging specific parameters for filter options and Log Routing section to route logs from different containers to separate Logsene applications                                                                                                                                                |
| -v /var/run/docker.sock                                  | Path to the docker socket                                                                                                                                                                                                                                                                                                                                |
| Optional Parameters:                                     |                                                                                                                                                                                                                                                                                                                                                          |
| REGION                                                   | Sematext Cloud region **US** or **EU** (default: US). The receiver URL will be set to EU/US default values. When using REGION, you don't need to set LOGS_RECEIVER_URL (see below).                                                                                                                                                                      |
| LOG_GLOB                                                 | Semicolon-separated list of file globs (e.g. /var/log/**/*.log;/mylogs/**/*.log) to collect log files from the host, assuming the log files are mounted to /mylogs using Docker -v /var/logs:/mylogs                                                                                                                                                     |
| LOGAGENT_ARGS                                            | Additional command line arguments for Logagent (e.g. LOGAGENT_ARGS="-n httpd" to specify a log source name or LOGAGENT_ARGS="-u 514" to act as syslog server)                                                                                                                                                                                            |
| --privileged                                             | The parameter might be helpful when Sematext Agent could not start because of limited permission to connect and write to the Docker socket /var/run/docker.sock. The privileged mode is a potential security risk, we recommend to enable the appropriate security. Please read about Docker security: https://docs.docker.com/engine/security/security/ |
| HTTPS_PROXY                                              | URL for a proxy server (behind firewalls)                                                                                                                                                                                                                                                                                                                |
| LOGS_RECEIVER_URL                                        | URL for bulk inserts into Sematext Cloud. Required for Sematext Enterprise (local IP:PORT) or Sematext Cloud Europe: https://logsene-receiver.eu.sematext.com                                                                                                                                                                                            |
| Docker Logs Parameters                                   |                                                                                                                                                                                                                                                                                                                                                          |
| TAGGING_LABELS                                           | A list of docker label names or environment variable names to tag container logs. Supporting wildcards e.g. TAGGING_LABELS='com.docker.swarm,com.myapp.'                                                                                                                                                                                                 |
| Whitelist containers for logging                         |                                                                                                                                                                                                                                                                                                                                                          |
| MATCH_BY_NAME                                            | Regular expression to white list container names                                                                                                                                                                                                                                                                                                         |
| MATCH_BY_IMAGE                                           | Regular expression to white list image names                                                                                                                                                                                                                                                                                                             |
| Blacklist containers                                     |                                                                                                                                                                                                                                                                                                                                                          |
| SKIP_BY_NAME                                             | Regular expression to black list container names                                                                                                                                                                                                                                                                                                         |
| SKIP_BY_IMAGE                                            | Regular expression to black list image names for logging                                                                                                                                                                                                                                                                                                 |
| PATTERNS_URL                                             | Load pattern.yml via HTTP e.g. -e PATTERNS_URL=https://raw.githubusercontent.com/sematext/logagent-js/master/patterns.yml                                                                                                                                                                                                                                |
| LOGAGENT_PATTERNS                                        | Pass patterns.yml via env. variable e.g. -e LOGAGENT_PATTERNS="$(cat ./patters.yml)"                                                                                                                                                                                                                                                                     |
| LOGAGENT_PATTERNS_BASE64                                 | Set to "true" if the LOGAGENT_PATTERNS patterns file you are passing in via env. variable is base64 encoded e.g `-e LOGAGENT_PATTERNS="$(cat ./patterns.yml &#124; base64)"`. Useful if your params file is not getting set properly due to shell interpretation or otherwise.                                                                                  |
| PATTERN_MATCHING_ENABLED                                 | Activate logagent-js parser, default value is true. To disable the log parser set the value to false. This could increase the throughput of log processing for nodes with a very high log volume.                                                                                                                                                        |
| -v /yourpatterns/patterns.yml:/etc/logagent/patterns.yml | to provide custom patterns for log parsing, see logagent-js                                                                                                                                                                                                                                                                                              |
| -v /tmp:/logsene-log-buffer                              | Directory to store logs, in a case of a network or service outage. Docker Agent deletes these files after successful transmission.                                                                                                                                                                                                                       |
| GEOIP_ENABLED                                            | trueenables GeoIP lookups in the log parser, default value: false                                                                                                                                                                                                                                                                                        |
| MAXMIND_DB_DIR                                           | Directory for the Geo-IP lite database, must end with /. Storing the DB in a volume could save downloads for updates after restarts. Using /tmp/ (ramdisk) could speed up Geo-IP lookups (requires add. ~30 MB main memory).                                                                                                                             |
| ENABLE_LOGSENE_STATS                                     | Enables logging of transmission stats to Sematext Cloud. Default value 'false'. Provides a number of logs received, a number of logs shipped, number of failed/successful HTTP transmissions (bulk requests to Sematext Cloud) and retransmissions of failed requests.                                                                                   |
| LOGSENE_REMOVE_FIELDS                                    | Removes fields from parsed/enriched logs. E.g. LOGSENE_REMOVE_FIELDS=logSource,container_host_name,swarm_node,password,creditCardNo                                                                                                                                                                                                                      |


See [Logagent Documentation](https://sematext.com/docs/logagent) for more info.

Note: Please use [sematext/sematext-agent-docker](https://hub.docker.com/r/sematext/sematext-agent-docker/) to collect container logs, host and container metrics and Docker events. Sematext Docker Agent supports log enrichment with all relevant container metadata like Swarm service names, Kubernetes metadata, etc. 

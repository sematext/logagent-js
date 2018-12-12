Logagent is a general purpose log shipper. The Logagent Docker image is pre-configured for the log collection on container platforms. It runs as a tiny container on every Docker host and collects logs for all cluster nodes and their containers. All container logs are enriched with Kubernetes and Docker Enterprise / Docker Swarm metadata.

## Getting started

To run Logagent you will need a Logs App Token.  
If you don't have Logs Apps yet, you can [create Apps now](https://apps.sematext.com/ui/integrations).

The [Logagent](https://sematext.com/logagent) docker container can be configured through the following environment variables:

* **REGION**: Sematext Cloud region **US** or **EU** (default: US). The receiver URL will be set to EU/US default values. When using REGION, you don't need to set `LOGS_RECEIVER_URL` (see below).
* **LOGS_RECEIVER_URL**: The URL of your Elasticsearch Endpoint _(defaults to Sematext Cloud US `https://logsene-receiver.sematext.com`)_. 
  
    * For Sematext Europe use `https://logsene-receiver.eu.sematext.com`. 
    * For Elasticsearch `https://elasticserch-server-name:9200`.

* **LOGS_TOKEN**: The index where the agent should log to _(for [Sematext Cloud](https://sematext.com/cloud) users the logs token)_
* **LOG_GLOB**: Semicolon-separated list of file globs <pre>/mylogs/**/*.log;/var/log/**/*.log</pre>. Mount your server log files into the container using a Docker volume e.g. <pre>-v /var/log:/mylogs</pre>
* **LOGAGENT_ARGS**: Additional [command line arguments for Logagent](https://sematext.com/docs/logagent/cli-parameters/) <pre>LOGAGENT_ARGS="-n httpd"</pre> to specify a log source name or <pre>LOGAGENT_ARGS="-u 514"</pre> to act as syslog server. Please refer to Logagent command line arguments in the [Logagent Documentation](https://sematext.com/docs/logagent/cli-parameters/)

### Docker Run Example

The most basic start method is using docker run command:

```
docker pull sematext/logagent
docker run -d --name logagent \
-e LOGS_TOKEN=YOUR_LOGS_TOKEN \
-e LOGS_RECEIVER_URL="https://logsene-receiver.sematext.com"
-v /var/run/docker.sock:/var/run/docker.sock sematext/logagent
```

# Documentation

For further information please read the [setup manual](https://sematext.com/docs/logagent/installation-docker/).
You find in the manual all configuration options and the setup instructins for Kubernetes, OpenShift, Mesos, Docker Enterprise etc. 


The [Logagent](https://sematext.com/logagent) docker container can be configured through the following environment variables:
* **REGION**: Sematext Cloud region **US** or **EU** (default: US). The receiver URL will be set to EU/US default values. When using REGION, you don't need to set LOGSENE_RECEIVER_URL (see below).
* ** Docker socket **  mount /var/run/docker.socket to collect all container logs
* **LOGSENE_RECEIVER_URL**: The URL of your Elasticsearch Endpoint _(defaults to Sematext Cloud US https://logsene-receiver.sematext.com)_. 
  - For Sematext Europe use https://logsene-receiver.eu.sematext.com. 
  - For Elasticsearch https://elasticserch-server-name:9200.
* **LOGSENE_TOKEN**: The index where the agent should log to _(for [Sematext Cloud](https://sematext.com/cloud) users the logs token)_

* **LOG_GLOB**: Semicolon-separated list of file globs _(e.g. /var/log/**/*.log;/my/app/logs/*.log)_
* **LA_ARGUMENTS**: Additional [command line arguments for Logagent](https://sematext.com/docs/logagent/cli-parameters/) _(e.g. LA_ARGUMENTS="-n httpd" to specify a log source name or LA_ARGUMENTS="-u 514" to act as syslog server)_
Run a container:


Collect all container logs including container meta data: 

```
docker run --name logagent \
-v /var/run/docker.sock:/var/run/docker.sock \
-e LOGSENE_TOKEN=YOUR_LOGSENE_TOKEN_HERE \
sematext/logagent
```

Get all container logs from from all Docker Swarm nodes
```
docker service create --mode global --name logagent \
--mount type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock \
-e LOGSENE_TOKEN=YOUR_LOGSENE_TOKEN_HERE \
-e LOGSENE_RECEIVER_URL=https://logsene-receiver.sematext.com  \
sematext/logagent
```

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
## Configuration Parameters

<div class="table-responsive">
<table class="mdl-data-table mdl-shadow--2dp" style="white-space: normal;">
<thead>
<tr>
<th>Parameter / Environment variable</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Required Parameters</strong></td>
<td></td>
</tr>
<td>LOGSENE_TOKEN</td>
<td>Logsene Application Token enables logging to Logsene, see logging specific parameters for filter options and Log Routing section to route logs from different containers to separate Logsene applications</td>
</tr>
<tr>
<td><code>-v /var/run/docker.sock</code></td>
<td>Path to the docker socket </td>
</tr>
<td><strong>Optional Parameters:</strong></td>
<td></td>
</tr>
<tr><td>REGION</td>
  <td>Sematext Cloud region **US** or **EU** (default: US). The receiver URL will be set to EU/US default values. When using REGION, you don't need to set LOGSENE_RECEIVER_URL (see below).
  </td>
</tr>
<tr>
  
<tr><td>LOG_GLOB</td>
  <td>Semicolon-separated list of file globs (e.g. <code>/var/log/**/*.log;/mylogs/**/*.log</code>) to collect log files from the host, assuming the log files are mounted to <code>/mylogs</code> using Docker <code> -v /var/logs:/mylogs</code> </td>
</tr>  
<tr><td>LA_ARGUMENTS</td>
  <td>
    Additional <a href="https://sematext.com/docs/logagent/cli-parameters/">command line arguments for Logagent</a> (e.g. <code>LA_ARGUMENTS="-n httpd"</code> to specify a log source name or <code>LA_ARGUMENTS="-u 514"</code> to act as syslog server)
</td>
</tr>  
<td>--privileged</td>
<td>The parameter might be helpful when Sematext Agent could not start because of limited permission to connect and write to the Docker socket /var/run/docker.sock. The privileged mode is a potential security risk, we recommend to enable the appropriate security. Please read about Docker security: https://docs.docker.com/engine/security/security/</td>
</tr>
<td>HTTPS_PROXY</td>
<td>URL for a proxy server (behind firewalls)</td>
</tr>
<tr>
<td>LOGSENE_RECEIVER_URL</td>
<td>URL for bulk inserts into Logsene. Required for Sematext Enterprise (local IP:PORT) or Sematext Cloud Europe: https://logsene-receiver.eu.sematext.com</td>
</tr>
<td>EVENTS_RECEIVER_URL</td>
<td>URL for SPM events receiver. Required for Sematext Enterprise (local IP:PORT) or Sematext Cloud Europe: https://event-receiver.eu.sematext.com</td>
</tr>
<tr>
<td><strong>Docker Logs Parameters</strong></td>
<td></td>
</tr>
<tr>
<td>TAGGING_LABELS</td>
<td>A list of docker label names or environment variable names to tag container logs. Supporting wildcards e.g. TAGGING_LABELS='com.docker.swarm<em>,com.myapp.</em>'</td>
</tr>
<tr>
<td><strong>Whitelist containers for logging</strong></td>
<td></td>
</tr>
<tr>
<td>MATCH_BY_NAME</td>
<td>Regular expression to white list container names</td>
</tr>
<tr>
<td>MATCH_BY_IMAGE</td>
<td>Regular expression to white list image names</td>
</tr>
<tr>
<td><strong>Blacklist containers</strong></td>
<td></td>
</tr>
<tr>
<td>SKIP_BY_NAME</td>
<td>Regular expression to black list container names</td>
</tr>
<tr>
<td>SKIP_BY_IMAGE</td>
<td>Regular expression to black list image names for logging</td>
</tr>
<tr>
<td>PATTERNS_URL</td>
<td>Load pattern.yml via HTTP e.g. <code>-e PATTERNS_URL=https://raw.githubusercontent.com/sematext/logagent-js/master/patterns.yml</code></td>
</tr>
<tr>
<td>LOGAGENT_PATTERNS</td>
<td>Pass patterns.yml via env. variable e.g. <code>-e LOGAGENT_PATTERNS="$(cat ./patters.yml)"</code></td>
</tr>
<tr>
<td>LOGAGENT_PATTERNS_BASE64</td>
<td>Set to "true" if the LOGAGENT_PATTERNS patterns file you are passing in via env. variable is base64 encoded e.g <code>-e LOGAGENT_PATTERNS="$(cat ./patterns.yml | base64)"</code>. Useful if your params file is not getting set properly due to shell interpretation or otherwise.</td>
</tr>
<tr>
<td>PATTERN_MATCHING_ENABLED</td>
<td>Activate <a href="http://sematext.com/docs/logagent/parser/">logagent-js parser</a>, default value is <code>true</code>. To disable the log parser set the value to <code>false</code>. This could increase the throughput of log processing for nodes with a very high log volume.</td>
</tr>
<tr>
<td style="word-break: break-all;">-v /yourpatterns/patterns.yml:/etc/logagent/patterns.yml</td>
<td>to provide custom patterns for log parsing, see <a href="https://github.com/sematext/logagent-js">logagent-js</a></td>
</tr>
<tr>
<td>-v /tmp:/logsene-log-buffer</td>
<td>Directory to store logs, in a case of a network or service outage. Docker Agent deletes these files after successful transmission.</td>
</tr>
<tr>
<td>GEOIP_ENABLED</td>
<td><code>true</code>enables GeoIP lookups in the log parser, default value: <code>false</code></td>
</tr>
<tr>
<td>MAXMIND_DB_DIR</td>
<td>Directory for the Geo-IP lite database, must end with <code>/</code>. Storing the DB in a volume could save downloads for updates after restarts. Using <code>/tmp/</code> (ramdisk) could speed up Geo-IP lookups (requires add. ~30 MB main memory).</td>
</tr>
<tr>
<td>ENABLE_LOGSENE_STATS</td>
<td>Enables logging of transmission stats to Logsene. Default value 'false'. Provides a number of logs received, a number of logs shipped, number of failed/successful HTTP transmissions (bulk requests to Logsene) and retransmissions of failed requests.</td>
</tr>
<tr>
<td>LOGSENE_REMOVE_FIELDS</td>
<td style="word-break: break-all;">Removes fields from parsed/enriched logs. E.g. LOGSENE_REMOVE_FIELDS=logSource,container_host_name,swarm_node,password,creditCardNo</td>
</tr>
</tbody>
</table>
</div>

See [Logagent Documentation](https://sematext.com/docs/logagent) for more info.

Note: Please use [sematext/sematext-agent-docker](https://hub.docker.com/r/sematext/sematext-agent-docker/) to collect container logs, host and container metrics and Docker events. Sematext Docker Agent supports log enrichment with all relevant container metadata like Swarm service names, Kubernetes metadata, etc. 

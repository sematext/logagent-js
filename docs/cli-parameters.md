## Command Line Parameters 
### Synopsis

```logagent [options] [file list]```

| Options | Description |
|---------|-------------|
| __Genernal options__ | |
| -h, --help | output logagent help |
| -V, --version | output logagent version |
| -v, --verbose | output activity report every minute |
| --config <configFileName> | path to logagent config file (see below) |
| --geoipEnabled <value> | true/false to enable/disable geoip lookups in patterns. |
| --diskBufferDir  path| directory to store status and buffered logs (during network outage) |
| --includeOriginalLine | includes the original message in parsed logs |
| -f, --file <patternFile> | file with pattern definitions, use multiple -f options multiple files| 
| -s, --suppress | silent, print no logs to stdout, prints only stats on exit |
| --printStats | print processing stats in the given interval in seconds, e.g. ```--print_stats 30``` to stderr. Usefull with -s to see logagent activity on the console without printing the parsed logs to stdout.|
| __Log input options__| |
| -g glob-pattern | use a [glob](https://www.npmjs.com/package/glob) pattern to watch log files e.g. ```-g "{/var/log/*.log,/Users/stefan/myapp/*.log}"```. The complete glob expression must be quoted, to avoid interpretation of special characters by the linux shell. |
+| --tailStartPosition bytes | -1 tail from end of file, >=0 start from given position (in bytes).  This setting applys for new files, having no position saved (see --logsene-tmp-dir)|
| --stdin | read from stdin, default if no other input like files or UDP are set|
| -n name | name for the log source only when stdin is used, important to make multi-line patterns working on stdin because the status is tracked by the log source name.| 
| -u UDP_PORT | starts a syslogd UDP listener on the given port to act as syslogd |
| --heroku PORT | listens for Heroku logs (http drain / framed syslog over http) |
| --cfhttp PORT | listens for Cloud Foundry logs (syslog over http)|
| list of files | Every argument after the options list is interpreted as file name. All files in the file list (e.g. /var/log/*.log) are watched by [tail-forever](https://www.npmjs.com/package/tail-forever) starting at end of file|
| __Output options__ | |
| __standard output stream__ | combine logagent with any unix tool via pipes |
| -y, --yaml | prints parsed messages in YAML format to stdout|
| -p, --pretty | prints parsed messages in pretty json format to stdout|
| -j, --ldjson | print parsed messages in line delimited JSON format to stdout |
| __Elasticsearch / Logsene__| Log storage |
| -e, --elasticsearchUrl <url> | Elasticsearch url e.g. http://localhost:9200, default htpps://logsene-receiver.sematext.com:443'|
| -t, --index <Logsene token/Elasticsearch index> | [Logsene](http://sematext.com/logsene) App Token to insert parsed records into Logsene or Elasticsearch index (see --elasticsearch-host) |
| --httpProxy <url> | HTTP proxy url |
| --httpsProxy <url> | HTTPS proxy url |
| __rtail__ | Realtime log viewer|
| --rtailPort  | forwards logs via UDP to [rtail](http://rtail.org/) server |
| --rtailHost hostname | [rtail](http://rtail.org/) server (UI for realtime logs), default: localhost|
| --rtailWebPort <port> | starts rtail UI webserver (if not installed install with: - npm i rtail -g) |
| --rtailWebHost <host> | rtail UI webserver and bind hostname. E.g. ```logagent --rtailWebPort 9000 --rtailPort 8989  --rtailWebHost $(hostname) -g \'/var/log/**/*.log``` |

The default output is line delimited JSON for parsed log lines, as long as no format options like -yaml (YAML format), -p (pretty JSON), or -s (silent, no output to console) are specified. 


## Environment variables
|Variable|Description|
|--------|-----------|
|LOGSENE_TMP_DIR | Directory to store failed bulk requests, for later re-transmission.|
|LOGSENE_LOG_INTERVAL | Time to batch logs before a bulk request is done. Default 10000 ms (10 seconds)|
|LOGSENE_BULK_SIZE | Maximum size of a bulk request. Default 1000.|
|LOGSENE_URL | URL for the Logsene receiver. For a local Elasticsearch server or for On-Premise version of Logsene. Defaults to Sematext Logsene SaaS receiver https://logsene-receiver.sematext.com/_bulk. Example for Elasticsearch: ```LOGSENE_URL=http://localhost:9200/_bulk```|
|HTTPS_PROXY|Proxy URL for HTTPS endpoints, like Logsene receiver. ```export HTTPS_PROXY=http://my-proxy.example```|
|HTTP_PROXY|Proxy URL for HTTP endpoints (e.g. On-Premises or local Elasticsearch). ```export HTTP_PROXY=http://my-proxy.example```|
|LOGAGENT_CONFIG | Filename to read logagent CLI parameters from a file, defaults to ```/etc/sematext/logagent.conf`` |
|PATTERN_MATCHING_ENABLED | Default is 'true'. The value 'false' disables parsing of logs. |


## Examples 
```
# Be Evil: parse all logs 
# stream logs to Logsene 1-Click ELK stack 
logagent -i LOGSENE_TOKEN /var/log/*.log 
# stream logs to local Elasticsearch  
logagent -e http://localhost:9200 -i myindex /var/log/*.log 

# Act as syslog server on UDP and forward messages to Logsene
logagent -u 514 -i LOGSENE_TOKEN  

# Act as syslog server on UDP and write YAML formatted messages to console
logagent -u 514 -y  
```

Use a [glob](https://www.npmjs.com/package/glob) pattern to build the file list 

```
logagent -i LOGSENE_TOKEN -g '/var/log/**/*.log'
# pass multiple glob patterns
logagent -i LOGSENE_TOKEN -g '{/var/log/*.log,/opt/myapp/*.log}'
```

Watch selective log output on console by passing logs via stdin and format in YAML

```
tail -f /var/log/access.log | logagent -y -n httpd
tail -f /var/log/system.log | logagent -f my_own_patterns.yml  -y 
```

Ship logs to rtail and Logsene to view logs in real-time in rtail and store logs in Logsene

```
# rtail don't need to be installed, logagent uses the rtail protocol
logagent -i $LOGSENE_TOKEN --rtailHost myrtailserver --rtailPort 9999 /var/log/*.log
```

Logagent can start the rtail web-server (in-process, saving memory), open browser with http://localhost:8080
```
# logagent has no dependency to rtail, to keep the package small
sudo npm i rtail -g
logagent -s -i $LOGSENE_TOKEN --rtailWebPort 8080 --rtailPort 9999 /var/log/*.log
```

And of course you can combine rtail and Logagent in the traditional way, simply connect both via unix pipes. An example with rtail and Logsene storage and charts:
![](http://g.recordit.co/usjLitb3Dd.gif)


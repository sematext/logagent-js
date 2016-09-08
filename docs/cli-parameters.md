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
| -e, --elasticsearch-host <url> | Elasticsearch url e.g. http://localhost:9200, default htpps://logsene-receiver.sematext.com:443'|
| -t, --index <Logsene token/Elasticsearch index> | [Logsene](http://sematext.com/logsene) App Token to insert parsed records into Logsene or Elasticsearch index (see --elasticsearch-host) |
| --httpProxy <url> | HTTP proxy url |
| --httpsProxy <url> | HTTPS proxy url |
| __rtail__ | Realtime log viewer|
| --rtailPort  | forwards logs via UDP to [rtail](http://rtail.org/) server |
| --rtailHost hostname | [rtail](http://rtail.org/) server (UI for realtime logs), default: localhost|
| --rtailWebPort <port> | starts rtail UI webserver (if not installed install with: - npm i rtail -g) |
| --rtailWebHost <host> | rtail UI webserver and bind hostname. E.g. ```logagent --rtailWebPort 9000 --rtailPort 8989  --rtailWebHost $(hostname) -g \'/var/log/**/*.log``` |

The default output is line delimited JSON for parsed log lines, as long as no format options like -yaml (YAML format), -p (pretty JSON), or -s (silent, no output to console) are specified. 

## Config File 

The config file needs to be in YAML format.
### Section: options

```
# Global options
options:
  # print stats every 60 seconds 
  printStats: 60
  # don't write parsed logs to stdout
  suppress: false
  # Enalbe/disable GeoIP lookups
  # Startup of logagent might be slower, when downloading the GeoIP database
  geoipEnabled: false
  # Directory to store Logagent status nad temporary files
  diskBufferDir: ./tmp
```

### Section: input

```
input:
  # a list of glob patterns to watch files to tail
  files:
      - '/var/log/**/*.log'
      - '/opt/myapp/logs/*.log'
  # listen to udp syslog protocol  
  #syslog: 
  #  port: 514
  # listen to http to receive data from Heroku  log drains  
  #heroku: 
  #  port: 9999
  # listen to http to receive data from Cloud Foundry drains  
  #cloudFoundry:
  #  port: 8888
```

### Section: parser

In this section defines loading of custom pattern files or inline pattern definitions for the log parser.

```
# optional, if not specified default patterns are used
parser:
  patternFiles:
    # load a list of pattern files to parse logs
    # later files overwrite settings from previous files
    # a 'hot reload' is done as soon one of the listed fiels changes on disk
    - patterns1.yml
    - patterns2.yml
  # inline pattern definitions, to put on top of patterns list
  # loaded from files or default librarary  
  patterns:
    - # timestamped messages from /var/log/*.log on Mac OS X
      sourceName: !!js/regexp /\system\.log/ # catch all system.log files  
      match:
        -
          type: system_log
          regex: !!js/regexp /([\w|\s]+\s+\d{2}\s[\d|\:]+)\s(.+?)\s(.+?)\s<(.+)>(.*)/
          fields: [ts,host,service,severity,message]
          dateFormat: MMM DD HH:mm:ss
```

### Section: output

Logs could be shipped to Elasticsearch or to rtail for realtime log view. 
The Elasticsearch output supports HTTPS, username/password in the url. 
In addtion it is possible to route logs from different files to different indicies in Elasticsearch. All logs, which don't match the rules in the indices section are routed to the default index (elasticsearch.index). 

```
output:
  # index logs in Elasticsearch or Logsene
  elasticsearch: 
    # URL to Elasticearch server, defaults to Logsene SaaS if not set
    url: https://logsene-receiver.sematext.com
    
    # Proxy settings behind firewalls
    #httpProxy:  http://localProxy:port
    #httpsProxy: https://localHttpsProxy:port
    
    # default index to use, for all logs that don't match later in indices section
    # for Logsene use the Logsene App Token here
    index: 0a835c75-9847-4f74-xxxx
    
    # specific index to use per logSource field of parsed logs
    # logSource is by default the file name of the log file
    # but it can be modified by JS transforms functions in the patterns.yml file
    indices: 
      4f70a0c7-9458-43e2-bbc5-xxxx: 
      # list of RegEx mathich logSource / filename  
      # all logs matching logSOurce name will be indexed to above index
        - .*wifi.*
        - .*bluetooth.*
      999532c9-18f1-4c4b-8753-xxxx: 
        - system\.log
        - access\.log
        - auth\.log
  # print parsed logs in YAML format to stdout (only if options.supress is set to false)    
  stdout: yaml # use 'pretty' for pretty json and 'ldjson' for line delimited json (default)
  
  # forward logs to rtail realtime log viewer
  #rtail:
    # rtail host to send logs to
    #host: localhost
    # rtails port to send logs to 
    #udpPort: 3434
    # start rtail Server with given http port and bind to address of hostname
    #webPort: 8080
    #webHost: localhost
```

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


## Command Line Examples 
```
# Be Evil: parse all logs 
# stream logs to Logsene 1-Click ELK stack 
logagent -i LOGSENE_TOKEN /var/log/*.log 

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
logagent -i $LOGSENE_TOKEN --rtail-host myrtailserver --rtail-port 9999 /var/log/*.log
```

Logagent can start the rtail web-server (in-process, saving memory), open browser with http://localhost:8080
```
# logagent has no dependency to rtail, to keep the package small
sudo npm i rtail -g
logagent -s -i $LOGSENE_TOKEN --rtail-web-port 8080 --rtail-port 9999 /var/log/*.log
```

And of course you can combine rtail and Logagent in the traditional way, simply connect both via unix pipes. An example with rtail and Logsene storage and charts:
![](http://g.recordit.co/usjLitb3Dd.gif)


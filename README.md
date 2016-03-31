[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy?template=https://github.com/sematext/logagent-js) - [read more](http://blog.sematext.com/2016/02/18/how-to-ship-heroku-logs-to-logsene-managed-elk-stack/)

# logagent-js

Smart Log Parser and Log Shipper written in Node. 

Key features: 
- intelligent pattern matching
- pattern library included 
- recognition of Date and Number fields
- easy to extend with custom patterns and JS transform functions
- replace sensitive data with SHA-1 hash codes
- GeoIP lookup with automatic GeoIP db updates (maxmind geopip-lite files)
- Command Line Tool
  - log format converter (e.g. text to JSON or YAML) 
  - Syslog Server (UDP)
  - [Heroku Log Drain](https://github.com/sematext/logagent-js#logagent-as-heroku-log-drain)
  - CloudFoundry Log Drain
  - Log shipper for [Logsene](http://www.sematext.com/logsene/) 
- Node.js module to integrate parsers into Node.js programs
- logagent-js is part of [SPM for Docker](https://github.com/sematext/spm-agent-docker) to parse Container Logs

_How does the parser work?_
The parser detects log formats based on a pattern library (yaml file) and converts it to a JSON Object:
- find matching regex in pattern library
- tag it with the recognized type
- extract fields using regex
- if 'autohash' is enabled, sensitive data is replaced with its sha1 hash code
- parse dates and detect date format
  (use 'ts' field for date and time combined) 
- create ISO timestamp in '@timestamp' field
- transform function to manipulate parsed objects
- unmatched lines end up with timestamp and original line in the message field
- JSON lines are parsed, and scanned for @timestamp and time fields (logstash and bunyan format)
- default patterns for many applications (see below)
- Heroku logs



To test patterns or convert logs from text to JSON use the command line tool 'logagent'. 
It reads from stdin and outputs line delimited JSON (or pretty JSON or YAML) to the console. 
In addtion it can forward the parsed objects directly to [Logsene](http://sematext.com/logsene).


# Use logagent-js in Node

```
npm i logagent-js --save
```

Use the Logparser module in your source code

``` 
var Logparser = require('logagent-js')
var lp = new Logparser('./patterns.yml')
lp.parseLine('log message', 'source name', function (err, data) {
    if(err) {
      console.log('line did not match with any pattern')
    }
    console.log(JSON.stringify(data))
})
```

Test your patterns:
```
cat myapp.log | bin/logagent -y -n myapp -f mypatterns.yml
```

# Installation 

## Get Node.js (debian/ubuntu)

Official Node.js [downloads and instructions](https://nodejs.org/en/download/).
E.g. for Debian/Ubuntu:
```
curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Install logagent-js 
```
npm i -g logagent-js
# ship all your logs to Logsene, parsed with timestamps - output on console in YAML format (-y)
logagent -t LOGSENE_TOKEN -y /var/log/*.log
```

## CLI Parameters:

- __-f__ file with pattern definitions 
- __-y__ prints parsed messages in YAML format
- __-p__ pretty json output
- __-s__ silent, print no logss, only throughput and memory usage on exit
- __-t__ token [Logsene](http://sematext.com/logsene) App Token to insert parsed records into Logsene.
- __-g__ use a [glob](https://www.npmjs.com/package/glob) pattern to watch log files e.g. -g "{/var/log/*.log,/Users/stefan/*/*.log}" 
- __-u__ UDP_PORT starts a syslogd UDP listener on the given port to act as syslogd
- __-n__ name for the source only when stdin is used (e.g. cat zookeeper.log | logagent -n zookeeper), important to make
  multi-line patterns working on stdin because the status is tracked by the source name. 
- __--heroku__ PORT listens for heroku logs (http drain / framed syslog over http) 
- __--cfhttp__ PORT listens for CloudFoundry logs (syslog over http)
- __--rtail-port__ forwards logs via udp to [rtail](http://rtail.org/) server 
- __--rtail-host__ hostname [rtail](http://rtail.org/) server (UI for realtime logs), default: localhost
- __list of files__, e.g. /var/log/*.log watched by tail-forver starting at end of file to watch

The default output is line delimited JSON.

Examples: 
```
# Be Evil: parse all logs 
# stream logs to Logsene 1-Click ELK stack 
logagent -t LOGSENE_TOKEN /var/log/*.log 
# Act as syslog server on UDP and forward messages to Logsene
logagent -t LOGSENE_TOKEN -u 1514 
# Act as syslog server on UDP and write YAML formated messages to console
logagent -u 1514 -y  
```

Use a [glob](https://www.npmjs.com/package/glob) pattern to build the file list 

```
logagent -t LOGSENE_TOKEN -g "{/var/log/*.log,/opt/myapp/*.log}" 
```

Watch selective log output on console by passing logs via stdin and format in YAML

```
tail -f /var/log/access.log | logagent -y 
tail -f /var/log/system.log | logagent -f my_own_patterns.yml  -y 
```

Ship logs to rtail and Logsene to view logs in real-time in rtail and store logs in Logsene

```
# rtail don't need to be installed, logagent uses the rtail protocol
logagent -t $LOGSENE_TOKEN --rtail-host myrtailserver --rtail-port 9999 /var/log/*.log
```

Logagent can start the rtail web-server (in-process, saving memory), open browser with http://localhost:8080
```
# logagent has no dependency to rtail, to keep the package small
sudo npm i rtail -g
logagent -s -t $LOGSENE_TOKEN --rtail-web-port 8080 --rtail-port 9999 /var/log/*.log
```

And of course you can combine rtail and Logagent in the traditional way, simply connect both via unix pipes. An example with rtail and Logsene storage and charts:
![](http://g.recordit.co/usjLitb3Dd.gif)

# Logagent as Heroku log drain

[Heroku](http://www.heroku.com) can forward logs to a [Log Drain](https://devcenter.heroku.com/articles/log-drains) 
```
heroku drain:add --app HerokuAppName URL 
```

To receive Heroku logs, logagent-js can be deployed to Heroku. It acts as HTTPS log drain. 

1. Get a free account [apps.sematext.com](https://apps.sematext.com/users-web/register.do)  
2. Create a [Logsene](http://www.sematext.com/logsene/) App to obtain the Logsene Token
3. Deploy logagent-js to Heroku 

[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy?template=https://github.com/sematext/logagent-js) or use the following commands:

  ```
  git clone https://github.com/sematext/logagent-js.git
  cd logagent-js
  heroku login 
  heroku create
  git push heroku master
  ```
4. Add the the log drain.  
  The URL format is https://loggerAppName.herokuapps.com/LOGSENE_TOKEN
  Use following command, using the dynamically given name from "heroku create".

  ```
  export LOGSENE_TOKEN=YOUR_LOGSENE_TOKEN
  heroku drains:add --app YOUR_HEROKU_MAIN_APPLICATION  `heroku info -s | grep web-url | cut -d= -f2`$LOGSENE_TOKEN
  ```
Now you can see your logs in Logsene, define Alert-Queries or use Kibana 4 for Dashboards. 

3. Scale logagent-js service on Heroku

In case of high log volume, scale logagent-js  on demand using 
```
heroku scale web=3
```

# Logagent as Linux or Mac OS X service 

Logagent detects the init system and installs systemd or upstart service scripts. 
On Mac OS X it creates a launchd service. Simply run:
```
npm i logagent-js -g # install logagent package globally
sudo logagent-setup LOGSENE_TOKEN
```

The setup script generates a configuraton file in ```/etc/sematext/logagent.conf```.
This file includes the CLI parameters for logagent running as service.
The default settings ship all logs from /var/log/**/*.log to Logsene. 

Location of service scripts:
- upstart: /etc/init/logagent.conf
- systemd: /etc/systemd/system/logagent.service
- launchd: /Library/LaunchDaemons/com.sematext.logagent.plist

Start/stop service: 
- upstart: ```service logagent stop/start```
- systemd: ```systemctl stop/start logagent```
- lauchnchd: ```launchctl start/stop com.sematext.logagent```

# Pattern definitions

The default pattern definition file include already patterns for:
- MongoDB, 
  - MySQL, 
  - Nginx, 
  - Redis, 
  - Elasticsearch
  - Apache 
    - Webserver (httpd), 
    - Zookeeper, 
    - Cassandra, 
    - Kafka,
    - HBase HDFS Data Node,
    - HBase Region Server,
    - Hadoop YARN Node Manager, 
    - Apache SOLR,
  - various Linux/Mac OS X system log files 

The file format is based on [JS-YAML](https://nodeca.github.io/js-yaml/), in short:

- - indicates an  array
- !js/regexp - indicates a JS regular expression
- !!js/function > - indicates a JS function 

Properties:
- patterns - the list of patterns, each pattern starts with "-"
- match: A group of patterns for a specific log source
- regex: a JS regular expression 
- fields: the field list of extracted match groups from the regex
- type: the type used in Logsene (Elasticsearch Mapping)
- dateFormat: the format of the special fields 'ts', if the date format matches, a new field @timestamp is generated
- transform: a JS function to manipulate the result of regex and date parsing

Example:

```
# Sensitive data can be replaced with a hashcode (sha1)
# it applies to fields matching the field names by a regular expression
# Note: this function is not optimized (yet) and might take 10-15% of performance
autohash: !!js/regexp /user|password|email|credit_card_number|payment_info/i
# activate GeoIP lookup
geoIP: true
# logagent updates geoip db files automatically
# pls. note write access to this directory is required
maxmindDbDir: /tmp/
patterns: 
  - # APACHE  Web Logs
  sourceName: httpd
  match: 
    # Common Log Format
    - regex:        !!js/regexp /([0-9a-f.:]+)\s+(-|.+?)\s+(-|.+?)\s+\[([0-9]{2}\/[a-z]{3}\/[0-9]{4}\:[0-9]{2}:[0-9]{2}:[0-9]{2}[^\]]*)\] \"(\S+?)\s(\S*?)\s{0,1}(\S+?)\" ([0-9|\-]+) ([0-9|\-]+)/i
      type: apache_access_common
      fields:       [client_ip,remote_id,user,ts,method,path,http_version,status_code,size]
      dateFormat: DD/MMM/YYYY:HH:mm:ss ZZ
      # lookup geoip info for the field client_ip
      geoIP: client_ip
      transform: !!js/function >
        function (p) {
          p.message = p.method + ' ' + p.path
        }
```

The default patterns are [here](/patterns.yml) - contributions are welcome.


# Related packages

- [Sematext Agent for Docker](https://github.com/sematext/sematext-agent-docker) - collects metrics, events and logs from Docker API and CoreOS. Logagent-js is a component of sematext-agent-docker. More Information: [Innovative Docker Log Management](http://blog.sematext.com/2015/08/12/docker-log-management/)
- [Logsene-CLI](https://github.com/sematext/logsene-cli) - Enables searching Logsene log entries from the command-line. 
- [SPM Agent for Node.js](https://github.com/sematext/spm-agent-nodejs) - collects performance metrics for Node and io.js applications
- [Custom Metrics](https://github.com/sematext/spm-metrics-js) - Custom Metrics for SPM 
- [Winston-Logsene](https://github.com/sematext/winston-logsene) - Logging for Node.js - Winston transport layer for Logsene

# Support 

- Twitter: [@sematext](http://www.twitter.com/sematext)
- Blog: [blog.sematext.com](http://blog.sematext.com)
- Homepage: [www.sematext.com](http://www.sematext.com)





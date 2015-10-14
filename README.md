# logagent-js

Smart Log Parser and Log Shipper written in Node. 

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
- default patterns for:
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

To test patterns or convert logs from text to JSON use the command line tool 'logagent'. 
It reads from stdin and outputs line delimited JSON (or pretty JSON or YAML) to the console. 
In addtion it can forward the parsed objects directly to [Logsene](http://sematext.com/logsene).

# Pattern definitions file

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
# autohash: !!js/regexp /user|client_ip|password|email|credit_card_number|payment_info/i

patterns: 
  - # APACHE  Web Logs
  sourceName: httpd
  match: 
    # Common Log Format
    - regex:        !!js/regexp /([0-9a-f.:]+)\s+(-|.+?)\s+(-|.+?)\s+\[([0-9]{2}\/[a-z]{3}\/[0-9]{4}\:[0-9]{2}:[0-9]{2}:[0-9]{2}[^\]]*)\] \"(\S+?)\s(\S*?)\s{0,1}(\S+?)\" ([0-9|\-]+) ([0-9|\-]+)/i
      type: apache_access_common
      fields:       [client_ip,remote_id,user,ts,method,path,http_version,status_code,size]
      dateFormat: DD/MMM/YYYY:HH:mm:ss ZZ
      transform: !!js/function >
        function (p) {
          p.message = p.method + ' ' + p.path
        }
```

The default patterns are [here](/patterns.yml) - contributions are welcome.

# Use logagent-js in Node

## Install it as local package
```
npm i logagent-js --save
```

## Use the Logparser module in your source code
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
cat some.log | bin/logagent -y -f mypatterns.yml
```

# Installation for the command line tool 

## Get Node.js (debian/ubuntu)

```
# Note the new setup script name for Node.js v0.12
curl -sL https://deb.nodesource.com/setup_0.12 | sudo bash -
# Then install with:
sudo apt-get install -y nodejs
```

# Install logagent-js as command line tool
```
npm i -g logagent-js
# ship all your logs to logsene, parsed, timestamped - displyed on console in YAML format (-y)
logagent -t LOGSENE_TOKEN -y /var/log/*.log
```

Parameters:

- -f file with pattern definitions 
- -y prints parsed messages in YAML format
- -p pretty json output
- -s silent, print only throughput
- -t token [Logsene](http://sematext.com/logsene) App Token to insert parsed records into Logsene
- -g use a [glob](https://www.npmjs.com/package/glob) pattern to watch log files e.g. -g "{/var/log/*.log,/Users/stefan/*/*.log}" 
- -u UDP_PORT starts a syslogd UDP listener on the given port to act as syslogd
- -n name for the source only when stdin is used (e.g. cat zookeeper.log | logagent -n zookeeper), important to make
  multi-line patterns working on stdin because the status is tracked by the source name. 
- --heroku PORT listens for heroku logs (http drain / framed syslog over http) 
- --cfhttp PORT listens for CloudFoundry logs (syslog over http)
- list of files, watched by tail-forver starting at end of file to watch

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
# Run Logagent on Heroku as HTTPS log drain

Heroku can forward logs via syslog or raw syslog messages over HTTPS using the command
```
heroku drain:add --app HerokuAppName URL 
```

To receive Heroku logs, logagent-js can be deployed to Heroku. It acts as HTTPS log drain. 

```
git clone https://github.com/sematext/logagent-js.git
cd logagent-js
heroku login 
heroku create
git push heroku master
```

Add the logagent-js URL as HTTPS drain for your application logs. 
The URL format is https://loggerAppName.herokuapps.com/LOGSENE_TOKEN

Use following command, using the dynamically given name from "heroku create".

```
export LOGSENE_TOKEN=YOUR_LOGSENE_TOKEN_FOR_TOUR_HEROKU_APP
heroku drains:add --app YOUR_HEROKU_MAIN_APPLICATION  `heroku info -s | grep web-url | cut -d= -f2`$LOGSENE_TOKEN
```

In case of high log volume, scale the logagent-js services on demand using 
```
heroku scale web=3
```

Now you can see your logs in Logsene, define Alert-Queroes or use Kibana 4 for Dashboards. 

# Run logagent as system service to monitor all logs e.g. in /var/log/

## Upstart script (ubuntu)

Modify this script and place it in /etc/init/logagent.conf


```
description "Upstart Logagent"

start on (local-filesystems and net-device-up IFACE=eth0)
stop on runlevel [!12345]

respawn

setuid syslog
setgid syslog
env NODE_ENV=production
env LOGSENE_TOKEN=YOUR_LOGSENE_TOKEN
chdir  /var/log

exec /usr/local/bin/logagent -s /var/log/*.log 
```

Start the service: 
```
sudo service logagent start
```

## Unit file for systemd startup

Create a service file for the logagent, in /etc/systemd/system/logagent.service
Set the Logsene Token and file list in "ExecStart" directive.

```
[Service]
Description=Sematext logagent-js
Environment=NODE_ENV=production
ExecStart=/usr/local/bin/logagent -s -t YOUR_LOGSENE_TOKEN /var/log/*.log
Restart=always
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=logagent
User=syslog
Group=syslog

[Install]
WantedBy=multi-user.target

```

Start the service

```
systemctl start logagent
```

# Related packages

- [SPM Agent for Docker](https://github.com/sematext/spm-agent-docker) - collects metrics, events and logs from Docker API and CoreOS. Logagent-js is a component of spm-agent-docker. More Information: [Innovative Docker Log Management](http://blog.sematext.com/2015/08/12/docker-log-management/)
- [Logsene-CLI](https://github.com/sematext/logsene-cli) - Enables searching Logsene log entries from the command-line. 
- [SPM Agent for Node.js](https://github.com/sematext/spm-agent-nodejs) - collects performance metrics for Node and io.js applications
- [Custom Metrics](https://github.com/sematext/spm-metrics-js) - Custom Metrics for SPM 
- [Winston-Logsene](https://github.com/sematext/winston-logsene) - Logging for Node.js - Winston transport layer for Logsene

# Support 

- Twitter: [@sematext](http://www.twitter.com/sematext)
- Blog: [blog.sematext.com](http://blog.sematext.com)
- Homepage: [www.sematext.com](http://www.sematext.com)





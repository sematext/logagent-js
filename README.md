# logagent-js

Smart Log Parser and Log Shipper written in Node. 

The parser detects log formats based on a pattern library (yaml file) and converts it to a JSON Object:
- find matching regex in pattern library
- tag it with the recognized type
- extract fields using regex
- parse dates and detect date format
  (use 'ts' field for date and time combined) 
- create ISO timestamp in '@timestamp' field
- transform function to manipulate parsed objects
- unmatched lines end up with timestamp and original line in the message field

To test patterns or convert logs from text to JSON use the command line tool 'logagent'. 
It reads from stdin and outputs line delemited JSON (or pretty JSON or YAML) to the console. 
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
npm i sematext/logagent-js
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

# Install logagent-js globally
```
npm i -g sematext/logagent-js
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
- list of files, watched by tail-forver starting at end of file to watch

The default output is line delimited JSON.

Examples: 
```
# Be Evil: parse all logs 
# stream it to Logsene 1-Click ELK stack 
logagent -t LOGSENE_TOKEN /var/log/*.log 
```

Use a [glob](https://www.npmjs.com/package/glob) pattern to build the file list 

```
logagent -t LOGSENE_TOKEN -g "{/var/log/*.log,/opt/myapp/*.log}"" 
```

Watch selective log output on console by passing logs via stdin and format in YAML

```
tail -f /var/log/system.log | logagent -f patterns.yml  -y 
tail -f /var/log/access.log | logagent -y 
```

# Related packages

- [Logsene-CLI](https://github.com/sematext/logsene-cli) - Enables searching Logsene log entries from the command-line. 
- [SPM Agent for Docker](https://github.com/sematext/spm-agent-docker) - collects metrics, events and logs from Docker API and CoreOS
- [SPM Agent for Node.js](https://github.com/sematext/spm-agent-nodejs) - collects performance metrics for Node and io.js applications
- [Custom Metrics](https://github.com/sematext/spm-metrics-js) - Custom Metrics for SPM 
- [Winston-Logsene](https://github.com/sematext/winston-logsene) - Logging for Node.js - Winston transport layer for Logsene

# Support 

Twitter: [@sematext](http://www.twitter.com/sematext)
Blog: [blog.sematext.com](http://blog.sematext.com)
Homepage: [www.sematext.com](http://www.sematext.com)





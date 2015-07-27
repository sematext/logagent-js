# logparser-js

Smart Log Parser written in Node.

The parser detects log formats based on a pattern library (yaml file) and converts it to a JSON Object:
- find matching regex in pattern library
- tag it with the recognized type
- extract fields using regex
- parse dates and detect date format
  (use 'ts' field for date and time combined) 
- create ISO timestamp in '@timestamp' field
- transform function to manipulate parsed objects
- unmatched lines end up with timestamp and original line in the message field

To test patterns or convert logs from text to JSON use the command line tool 'logparser'. 
It reads from stdin and outputs line delemited JSON (or pretty JSON or YAML) to the console. 
In addtion it can forward the parsed objects directly to [Logsene](http://sematext.com/logsene).

# Installation 

## Get Node.js (debina/ubuntu)

```
# Note the new setup script name for Node.js v0.12
curl -sL https://deb.nodesource.com/setup_0.12 | sudo bash -
# Then install with:
sudo apt-get install -y nodejs
```

# Install logparser-js globally
```
npm i -g sematext/logparser-js
# ship all your logs to logsene, parsed, timestamped - displyed on console in YAML format (-y)
logparser -t LOGSENE_TOKEN -y /var/log/*.log
```

Parameters:

- -f file with pattern definitions 
- -y prints parsed messages in YAML format
- -p pretty json output
- -s silent, print only throughput
- -t token [Logsene](http://sematext.com/logsene) App Token to insert parsed records into Logsene
- list of files, watched by tail-forver starting at end of file to watch

The default output is line delimited JSON.

Examples: 
```
# Be Evil: parse all logs 
# stream it to Logsene 1-Click ELK stack 
logparser -t LOGSENE_TOKEN /var/log/*.log 
# Watch selective logs by passing logs via stdin and use your own pattern file
tail -f /var/log/*.log | logparser -f patterns.yml  -y 
# view apache access logs in yml format
tail -f /var/log/access.log | logparser -y 

```

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

# Use logparser-js in Node

## Install it as local package
```
npm i sematext/logparser-js
```

## Use it in your source code
``` 
var Logparser = require('logparser-js')
var lp = new Logparser('./patterns.yml')
lp.parseLine('log message', 'source name', function (err, data) {
    if(err) {
      console.log('line did not match with any pattern')
    }
    console.log(JSON.stringify(data))
})
```




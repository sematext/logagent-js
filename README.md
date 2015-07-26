# logparser-js

Smart Log Parser written in Node.

The parser detects log formats based on a pattern library (yaml file) and converts it to a JSON Object.
It includes all extracted fields. Date and time is combined in special field named 'ts' - it is paresed by moment.js and converted to a Date object
and stored in the field '@timestamp'. The object with the parsed fields can be manipulated after parsing using a 'transform' function,
defined in the pattern definition.

A command line tool 'logsene-parser' is provided. It reads from stdin and outputs line delemited JSON (or pretty JSON or YAML) to the console to test the patterns. 
In addtion it can forward the parsed objects directly to Logsene.

# Installation 

```
npm i sematext/logparser-js -g
```

Parameters:

- -f file with pattern definitions 
- -y prints parsed messages in YAML format
- -p pretty json output
- -s silent, print only throughput
- -t token [Logsene](http://sematext.com/logsene) App Token to insert parsed records into Logsene

The default output is line delimited JSON.

Example: 
```
# pipe your logs to Logsene 1-Click ELK stack 
tail -f /var/log/*.log | logsene-parser -f patterns.yml  -y --token LOGSENE_TOKEN
# view apache access logs in yml format
tail -f /var/log/access.log | logsene-parser -f patterns.yml -y 
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

``` 
var Logparser = require('logparser-js')
var lp = new Logparser('./patterns.yml')
lp.parseLine('log maessage goes here', 'test', function (err, data) {
    if(err) {
      console.log('line did not match with any pattern')
    }
    console.log(JSON.stringify(data))
})
```




## How does the parser work?

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

The default pattern definition file include already patterns for:

- MongoDB, 
- MySQL, 
- Nginx, 
- Redis, 
- Elasticsearch
- Webserver (nginx, apache httpd), 
- Zookeeper, 
- Cassandra, 
- Kafka,
- HBase HDFS Data Node,
- HBase Region Server,
- Hadoop YARN Node Manager, 
- Apache SOLR,
- various Linux/Mac OS X system log files 

The file format is based on [JS-YAML](https://nodeca.github.io/js-yaml/), in short:
```
- - indicates an  array
- !js/regexp - indicates a JS regular expression
- !!js/function > - indicates a JS function 
```

Properties:

- patterns - the list of patterns, each pattern starts with "-"
- match: A group of patterns for a specific log source
- regex: a JS regular expression 
- fields: the field list of extracted match groups from the regex
- type: the type used in Logsene (Elasticsearch Mapping)
- dateFormat: the format of the special fields 'ts', if the date format matches, a new field @timestamp is generated
- transform: a JS function to manipulate the result of regex and date parsing

# Example

```
# Sensitive data can be replaced with a hashcode (sha1)
# it applies to fields matching the field names by a regular expression
# Note: this function is not optimized (yet) and might take 10-15% of performance
autohash: !!js/regexp /user|password|email|credit_card_number|payment_info/i
# set this to false when authash fields
# the original line might include sensitive data!
originalLine: false
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

The default patterns are [here](https://github.com/sematext/logagent-js/blob/master/patterns.yml) - contributions are welcome.


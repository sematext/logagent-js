[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy?template=https://github.com/sematext/logagent-js) - [read more](http://blog.sematext.com/2016/02/18/how-to-ship-heroku-logs-to-logsene-managed-elk-stack/)

# logagent-js

Smart Log Parser and Log Shipper written in Node. 

# Features

This project contains a library and patterns for log parsing and cli tools and installers to use logagent-js as log shipper with following features: 

## Parser
- log format detection and intelligent pattern matching 
- pattern library included 
- recognition of Date and Number fields
- easy to extend with custom patterns and JS transform functions
- replace sensitive data with SHA-1 hash codes
- GeoIP lookup with automatic GeoIP db updates (maxmind geopip-lite files)

## Command Line Tool

- log format converter (e.g. text to JSON, line delimited JSON or YAML) 
- Log shipper for [Logsene](http://www.sematext.com/logsene/)

  - including cli, launchd (Mac OS X), upstart and systemd (Linux) service installer
  - disk buffer for failed inserts during network outage

## Inputs
- Standart input (stdin) taking the output stream from any Linux cli tool
  - patterns are applied to each incomming text lines, including support for multi-line patters, e.g. for Java Stack Traces and JSON parser. 
- Syslog Server (UDP) - reception of Syslog messages via UDP. The parser is applied to the message field. 
- [Heroku Log Drain](https://github.com/sematext/logagent-js#logagent-as-heroku-log-drain)
- CloudFoundry Log Drain

## Processing
- logagent-js applies the patterns defined in ```patterns.yml' to all logs to create structured output from plain text lines. Patterns are defined for input sources with regular expressions. The parsed logs can be post-processed with node.js transform function e.g. to enrich data or perform complex parser operations. 
- GeoIP lookups for IP adress fields, including download and update of the GeoIP lite database from Maxmind

## Security
- Masking sensitive data - Logagent can relace field content with SHA-1 hash codes to mask sensitive data. The advantage of hash codes is that data is still searchable when you hash the original value before you start a search.  In addtion it is possible to exclude the original log line from shipping to avoid that sensitive data gets shipped in the field "originalLogLine".
- Shipping logs to Logsene is done via https by default 
- Support of proxy servers if the logging server is behind a firewall

## Reliable log shipping with disk buffer

Logagent stores parsed logs to disk in case the network connection to the Elasticsearch API fails. Logagent retries to ship the logs later, when the network or Elasticsearch server is available again.  

## Outputs
- bulk inserts to [Logsene](http://sematext.com/logsene) / Elasticsearch API
- JSON, line delimited JSON and YML to stadard output  

## Deployment options
- Deployable as system service: systemd, upstart (Linux) launchd (Mac OS X)setups 
- Docker Container to receive logs via syslog
- Deployement to Heroku as Heroku Log drain

## API 
- Node.js module to integrate parsers into Node.js programs
- logagent-js is part of [SPM for Docker](https://github.com/sematext/spm-agent-docker) to parse Container Logs


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
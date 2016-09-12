[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy?template=https://github.com/sematext/logagent-js) - [read more](http://blog.sematext.com/2016/02/18/how-to-ship-heroku-logs-to-logsene-managed-elk-stack/)

# @sematext/logagent

Smart and lightweight Log Parser and Log Shipper written in Node. It can ship logs to Elasticsearch and thus also to [Logsene](http://www.sematext.com/logsene/). See [Documentation](http://sematext.github.io/logagent-js/).

Note: Previous documentation [v1.x](http://megastef.github.io/logagent-js/)

# Features

This project contains a library and patterns for log parsing and cli tools and installers to use logagent-js as log shipper with the following features: 

## Parser
- log format detection and intelligent pattern matching 
- pattern library included 
- easy to extend with custom patterns and JS transform functions
- recognition of Date and Number fields
- replace sensitive data with SHA-1 hash codes
- GeoIP lookup with automatic GeoIP db updates (maxmind geopip-lite files)

## Command Line Tool

- log format converter (e.g. text to JSON, line delimited JSON or YAML)
- log shipper for [Logsene](http://www.sematext.com/logsene/) and Elasticsearch

  - service installer for launchd (Mac OS X), upstart and systemd (Linux) 
  - disk buffer for failed inserts during network outage

## Inputs
- Standard input (stdin) that can read the output stream from any Linux cli tool
  - patterns are applied to each incoming text line; includes support for multi-line patters, e.g. for Java Stack Traces and JSON input.
- Syslog Server (UDP) listener - logagent-js can also act as a syslog server and receive Syslog messages via UDP. The parser is applied to the message field. 
- [Heroku Log Drain](https://github.com/sematext/logagent-js#logagent-as-heroku-log-drain) makes it easy to ship Heroku logs to Elasticsearch or [Logsene](http://www.sematext.com/logsene/)
- Cloud Foundry Log Drain

## Processing
- logagent-js applies patterns defined in patterns.yml to all logs and creates structured logs from plain-text log lines
- GeoIP lookups for IP address fields, including automatic download and update of the GeoIP lite database from Maxmind

## Reliable log shipping with disk buffer

Logagent doesn't lose data.  It stores parsed logs to a disk buffer if the network connection to the Elasticsearch API fails.  Logagent retries shipping logs later, when the network or Elasticsearch is available again.  

## Outputs
- bulk inserts to Elasticsearch and [Logsene](http://sematext.com/logsene) / Elasticsearch API
- JSON, line delimited JSON and YAML to standard output 
- UDP forwarding to rtail server for realtime log view 

## Deployment options
- Deployable as a system service: systemd, upstart (Linux), or launchd (Mac OS X)
- Docker Container to receive logs via syslog
- Deployement to Heroku as Heroku Log drain
- Deployement to Cloud Foundry as Cloud Foundry Log drain (thus usable with Pivotal, Bluemix, etc.)

## API 
- Node.js module to integrate parsers into Node.js programs
- logagent-js is a part of [SPM for Docker](https://github.com/sematext/sematext-agent-docker) to parse Container Logs


# Related packages

- [Sematext Agent for Docker](https://github.com/sematext/sematext-agent-docker) - collects metrics, events and logs from Docker API and CoreOS. Logagent-js is a component of sematext-agent-docker. More Information: [Innovative Docker Log Management](http://blog.sematext.com/2015/08/12/docker-log-management/)
- [Logsene-CLI](https://github.com/sematext/logsene-cli) - Enables searching Logsene log entries from the command-line. 
- [SPM Agent for Node.js](https://github.com/sematext/spm-agent-nodejs) - collects performance metrics for Node and io.js applications
- [Custom Metrics](https://github.com/sematext/spm-metrics-js) - Custom Metrics for SPM 
- [Winston-Logsene](https://github.com/sematext/winston-logsene) - Logging for Node.js - Winston transport layer for Logsene

# Support 

- Twitter: [@sematext](http://twitter.com/sematext)
- Blog: [sematext.com/blog](http://sematext.com/blog)
- Homepage: [sematext.com](http://sematext.com)

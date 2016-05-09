[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy?template=https://github.com/sematext/logagent-js) - [read more](http://blog.sematext.com/2016/02/18/how-to-ship-heroku-logs-to-logsene-managed-elk-stack/)

# logagent-js

Smart Log Parser and Log Shipper written in Node. 

# Features

This project contains a liraray and patterns for log parsing and cli tools and installers to use logagent-js as log shipper having following features: 

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
- logagent-js applies the patterns defined in ```patterns.yml' to all logs to create structured output from plain text lines
- GeoIP lookups for IP adress fields, including download and update of the GeoIP lite database from Maxmind

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


# Documentation

The documentation is available [here](http://sematext.github.io/logagent-js/). 

# Quickstart 

## Preparation: Install Node.js 

Official Node.js [downloads and instructions](https://nodejs.org/en/download/).
E.g. for Debian/Ubuntu:
```
curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
sudo apt-get install -y nodejs
```

# Install logagent-js with npm
```
npm i -g logagent-js
# Be Evil: parse all logs 
# stream logs to Logsene 1-Click ELK stack 
logagent -t LOGSENE_TOKEN /var/log/*.log 
# Act as syslog server on UDP and write YAML formated messages to console
logagent -u 514 -y  
# Act as syslog server on UDP and forward messages to Logsene
logagent -t LOGSENE_TOKEN -u 514 
# Install the service (Linux, Mac OS X)
sudo logagent-setup LOGSENE_TOKEN
# Change CLI parameters to your needs
vi /etc/sematext/logagent.conf
```

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
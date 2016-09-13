[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy?template=https://github.com/sematext/logagent-js) - [read more](http://blog.sematext.com/2016/02/18/how-to-ship-heroku-logs-to-logsene-managed-elk-stack/)

# Logagent

Smart and lightweight Log Parser and Log Shipper written in Node. It can ship logs to Elasticsearch and thus also to [Logsene](http://www.sematext.com/logsene/). See [Documentation](http://sematext.github.io/logagent-js/).

# Status of this package

This is the repository for [logagent v2.x](https://github.com/sematext/logagent-js), currently in beta. 
- See [logagent 2.x features and status](https://github.com/sematext/logagent-js/milestone/1)
- **Please use [logagent-js 1.x](https://www.npmjs.com/package/logagent-js) for production. 
Source code for [logagent-js 1.x](https://github.com/sematext/logagent-js/tree/1.x)**

## Major changes to 1.x
- new [config file format](http://sematext.github.io/logagent-js/config-file) (YAML)
   - support for multiple pattern definition files (including hot reload)
   - [log routing to multiple elasticsearch indices](http://sematext.github.io/logagent-js/config-file/#section-output) by event source name 
- support for [plugins](http://sematext.github.io/logagent-js/plugins/) as 3rd party npm modules
- naming of [command line arguments](http://sematext.github.io/logagent-js/cli-parameters/) run logagent --help to see all options

# Quickstart 

## Install Node.js 

Official Node.js [downloads and instructions](https://nodejs.org/en/download/).
E.g. for Debian/Ubuntu:
```
curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
sudo apt-get install -y nodejs
```

# Install logagent-js with npm

```
sudo npm i -g @sematext/logagent 
```

Install service for logagent using [systemd, upstart, lauchd](http://sematext.github.io/logagent-js/installation/#install-service-linux-mac-os-x)

```
sudo logagent-setup LOGSENE_TOKEN
```

Edit the config file in /etc/sematext/logagent.conf - by default all logs from /var/log/**/*.log are shipped to Logsene.

```
sudo service logagent restart # upstart
```

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
- log shipper for [Logsene](http://www.sematext.com/logsene/)

  - including cli, launchd (Mac OS X), upstart and systemd (Linux) service installer
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
- bulk inserts to [Logsene](http://sematext.com/logsene) / Elasticsearch API
- JSON, line delimited JSON and YML to standard output  

## Deployment options
- Deployable as a system service: systemd, upstart (Linux), or launchd (Mac OS X)
- Docker Container to receive logs via syslog
- Deployment to Heroku as Heroku Log drain
- Deployment to Cloud Foundry as Cloud Foundry Log drain (thus usable with Pivotal, Bluemix, etc.)

## API 
- Node.js module to integrate parsers into Node.js programs
- logagent-js is a part of [SPM for Docker](https://github.com/sematext/sematext-agent-docker) to parse Container Logs


# Documentation

The documentation is available [here](http://sematext.github.io/logagent-js/). 



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

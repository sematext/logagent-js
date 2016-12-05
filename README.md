[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy?template=https://github.com/sematext/logagent-js) - [read more](http://blog.sematext.com/2016/02/18/how-to-ship-heroku-logs-to-logsene-managed-elk-stack/)

# What is Logagent

Logagent is a modern, open-source, light-weight log shipper. It is like Filebeat and Logstash in one, without the JVM memory footprint.  It comes with out of the box and extensible log parsing, on-disk buffering, secure transport, and bulk indexing to Elasticsearch, Logsene, and other destinations. Its low memory footprint and low CPU overhead makes it suitable for deploying on edge nodes and devices, while its ability to parse and structure logs makes it a great Logstash alternative. 

![](https://sematext.com/wp-content/uploads/2016/07/logagent.png)

# Installation

**1) Install Node.js**

Official Node.js [downloads and instructions](https://nodejs.org/en/download/). E.g. for Debian/Ubuntu:

```	
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt-get install -y nodejs
Install Logagent with npm
sudo npm i -g @sematext/logagent
```

** 2) run logagent command line tool** 

```
logagent --help
```
**3) Example: Index your log files in Elasticsearch**

```
logagent -e http://localhost:9200 -i logs -g ‘/var/log/**/*.log’
```

**4) Optional: Install service & config**
 
Install service for Logagent using systemd, upstart, launchd
To quickly create a config file for indexing into Elasticsearch without having to edit it run something like this:

```
sudo logagent-setup http://localhost:9200/INDEX_NAME ‘/var/log/**/*.log’
Logsene users - use https://logsene-receiver.sematext.com/LOGSENE_APP_TOKEN.
```

**Configuration**

To configure different inputs, different event processing, or different outputs (e.g. your own Elasticsearch) edit /etc/sematext/logagent.conf, e.g.:

```
output:
  elasticsearch:
    url: http://elasticsearch-server:9200
    index: logs
```

Then restart the service with sudo service logagent restart. 
Troubleshooting & Logs
Logagent’s own logs:

- Upstart: ```/var/log/upstart/logagent.log```
- Systemd: ```journalctl -u logagent```
- Launchd: ```/Library/Logs/logagent.log```


Location of service scripts: 

- Upstart: ```/etc/init/logagent.conf ```
- Systemd: ```/etc/systemd/system/logagent.service``` 
- Launchd: ```/Library/LaunchDaemons/com.sematext.logagent.plist```


Start/stop service:
 
- Upstart: ```service logagent stop/start``` 
- Systemd: ```systemctl stop/start logagent``` 
- Launchd: ```launchctl start/stop com.sematext.logagent```


# Documentation

## Community, More Info & Support
- [Full documentation is available here](http://sematext.github.io/logagent-js/)
- [Logagent main page](https://sematext.com/logagent)
- [Logagent on Github](https://github.com/sematext/logagent-js)
- Twitter: [@sematext](https://twitter.com/sematext)
- Blog: [sematext.com/blog](https://sematext.com/blog)
- Forum: [https://groups.google.com/forum/#!forum/logagent](https://groups.google.com/forum/#!forum/logagent)




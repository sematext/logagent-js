## Install Node.js 

Official Node.js [downloads and instructions](https://nodejs.org/en/download/).
E.g. for Debian/Ubuntu:
```
curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
sudo apt-get install -y nodejs
```

# Install Logagent
```
sudo npm i -g @sematext/logagent 
```

## Install service (Linux, Mac OS X)

1. Get a free account at [sematext.com/spm](https://apps.sematext.com/users-web/register.do)
2. [create a Logsene App](https://apps.sematext.com/logsene-reports/registerApplication.do) to obtain an App Token for [Logsene](http://www.sematext.com/logsene/) 
3. Install logagent as system service
Logagent detects the init system and installs systemd or upstart service scripts. 
On Mac OS X it creates a launchd service. Simply run:
```
# install logagent package globally 
sudo npm i -g @sematext/logagent
sudo logagent-setup LOGSENE_TOKEN
```

The setup script generates the configuraton file in ```/etc/sematext/logagent.conf```.
The default settings ship all logs from ```/var/log/**/*.log``` to Logsene. 

Location of service scripts:
- upstart: /etc/init/logagent.conf
- systemd: /etc/systemd/system/logagent.service
- launchd: /Library/LaunchDaemons/com.sematext.logagent.plist

Start/stop service: 
- upstart: ```service logagent stop/start```
- systemd: ```systemctl stop/start logagent```
- launchd: ```launchctl start/stop com.sematext.logagent```


## Logagent in a Docker Container as Syslog Listener
You can build a Docker image with logagent running in it and activing as a Syslog UDP listener.  Then you can run this as a container.  Once you have this "containerized logagent" you can start all yoour other containers with Syslog driver and point it to the "containerized logagent's" UDP port (514).  Here are the steps:

Build the docker image, and then run logagent inside it with the given LOGSENE_TOKEN
```
git clone https://github.com/sematext/logagent-js.git
cd logagent-js
docker build -t logagent . 
docker run -p 514:514/udp -e LOGSENE_TOKEN=YOUR_LOGSENE_TOKEN -d --name logagent --restart=always logagent
```

Run your other containers with Syslog driver
```
export $DOCKER_HOSTNAME=192.168.99.100
docker run --log-driver=syslog --log-opt syslog-address=udp://$DOCKER_HOSTNAME:514 --log-opt tag="{{.ImageName}}#{{.Name}}#{{.ID}}" -p 9003:80 -d nginx
curl $DOCKER_HOSTNAME:9003
```

**Container Options**
- Pass a custom pattern file
```
-v $PWD/patterns.yml:/patterns.yml -e PATTERN_FILE=/patterns.yml
```
- Set any CLI option
e.g. print logs in YML format to console (default is "-s" - silent)
```
-e LOGAGENT_OPTIONS="-y"
```

To view realtime logs in the Web Browser with rtail, simply add the options for rtail and open the http port for rtail-server UI. Please note: _rtail UI might be slow for high log volumes_

```
export LOGAGENT_OPTIONS="-s --rtail-host $HOSTNAME --rtail-web-port 80 --rtail-port 9999"
docker run -p 8080:80 -p 514:514/udp -e LOGAGENT_OPTIONS -e LOGSENE_TOKEN=YOUR_LOGSENE_TOKEN -d --name logagent --restart=always logagent
```

- Set Node.js Memory limits
```
-e NODE_OPTIONS="--max-old-space-size=200"
```

Please note [Sematext Agent Docker](https://hub.docker.com/r/sematext/sematext-agent-docker/) might be of interest if you like to collect logs, events and metrics from Docker. 

## Run Logagent as Heroku Log Drain

You can forward your [Heroku](http://www.heroku.com) logs to Logsene using Heroku [Log Drain](https://devcenter.heroku.com/articles/log-drains) like this:
```
heroku drain:add --app HerokuAppName URL
```
Here are the steps:

To ship your Heroku logs to Logsene or Elasticsearch deploy Logagent on Heroku. It will act as an HTTPS log drain. 

1. Get a free account [apps.sematext.com](https://apps.sematext.com/users-web/register.do)
2. Create a [Logsene](http://www.sematext.com/logsene/) App to obtain the Logsene Token
3. Deploy logagent-js to Heroku using the Deploy to Heroku button

[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy?template=https://github.com/sematext/logagent-js) 
... or use the following commands:

  ```
  git clone https://github.com/sematext/logagent-js.git
  cd logagent-js
  heroku login 
  heroku create
  git push heroku master
  ```
4. Add the log drain using the URL format like https://loggerAppName.herokuapps.com/LOGSENE_TOKEN.
  Use the following command to grab the dynamically assigned name from "heroku create" command.

  ```
  export LOGSENE_TOKEN=YOUR_LOGSENE_TOKEN
  heroku drains:add --app YOUR_HEROKU_MAIN_APPLICATION `heroku info -s | grep web-url | cut -d= -f2`$LOGSENE_TOKEN
  ```
Now you can see your logs in Logsene, define Alert-Queries or use Kibana for Dashboards. 

3. Scale logagent-js service on Heroku

In case of high log volume, scale logagent-js on demand using 
```
heroku scale web=3
```
See also:
- [How to Ship Heroku Logs to Logsene / Managed ELK Stack](https://sematext.com/blog/2016/02/18/how-to-ship-heroku-logs-to-logsene-managed-elk-stack/)

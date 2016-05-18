## Preparation: Install Node.js 

Official Node.js [downloads and instructions](https://nodejs.org/en/download/).
E.g. for Debian/Ubuntu:
```
curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
sudo apt-get install -y nodejs
```

# Logagnet command line tool with npm
```
npm i -g logagent-js
# Test to ship your logs to Logsene, parsed with timestamps - output on console in YAML format (-y)
logagent -y /var/log/*.log
```

## Linux or Mac OS X service for Logsene

1. Get a free account at [sematext.com/spm](https://apps.sematext.com/users-web/register.do)  
2. [create a Logsene App](https://apps.sematext.com/logsene-reports/registerApplication.do) to obtain an App Token for [Logsene](http://www.sematext.com/logsene/) 
3. Install logagnet as system service
Logagent detects the init system and installs systemd or upstart service scripts. 
On Mac OS X it creates a launchd service. Simply run:
```
npm i logagent-js -g # install logagent package globally
sudo logagent-setup LOGSENE_TOKEN
```

The setup script generates a configuraton file in ```/etc/sematext/logagent.conf```.
This file includes the CLI parameters for logagent running as service.
The default settings ship all logs from ```/var/log/**/*.log`` to Logsene. 

Location of service scripts:
- upstart: /etc/init/logagent.conf
- systemd: /etc/systemd/system/logagent.service
- launchd: /Library/LaunchDaemons/com.sematext.logagent.plist

Start/stop service: 
- upstart: ```service logagent stop/start```
- systemd: ```systemctl stop/start logagent```
- lauchnchd: ```launchctl start/stop com.sematext.logagent```


## Docker - receive logs via syslog 
Build the image and start logagent with the LOGSENE_TOKEN
```
git clone https://github.com/sematext/logagent-js.git
cd logagent-js
docker build -t logagent . 
docker run -p 514:514/udp -e LOGSENE_TOKEN=YOUR_LOGSENE_TOKEN  -d --name logagent --restart=always logagent
```

Run your container with syslog driver
```
export $DOCKER_HOSTNAME=192.168.99.100
docker run --log-driver=syslog  --log-opt syslog-address=udp://$DOCKER_HOSTNAME:514 --log-opt tag="{{.ImageName}}#{{.Name}}#{{.ID}}" -p 9003:80 -d nginx
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
docker run -p 8080:80 -p 514:514/udp -e LOGAGENT_OPTIONS -e LOGSENE_TOKEN=YOUR_LOGSENE_TOKEN  -d --name logagent --restart=always logagent
```

- Set Node.js Memory limits
```
-e NODE_OPTIONS="--max-old-space-size=200"
```

Please note [Sematext Agent Docker](https://hub.docker.com/r/sematext/sematext-agent-docker/) might be of interest if you like to collect logs, events and metrics from Docker. 

## Install logagent as Heroku log drain

[Heroku](http://www.heroku.com) can forward logs to a [Log Drain](https://devcenter.heroku.com/articles/log-drains) 
```
heroku drain:add --app HerokuAppName URL 
```

To receive Heroku logs, logagent-js can be deployed to Heroku. It acts as HTTPS log drain. 

1. Get a free account [apps.sematext.com](https://apps.sematext.com/users-web/register.do)  
2. Create a [Logsene](http://www.sematext.com/logsene/) App to obtain the Logsene Token
3. Deploy logagent-js to Heroku 

[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy?template=https://github.com/sematext/logagent-js) or use the following commands:

  ```
  git clone https://github.com/sematext/logagent-js.git
  cd logagent-js
  heroku login 
  heroku create
  git push heroku master
  ```
4. Add the the log drain.  
  The URL format is https://loggerAppName.herokuapps.com/LOGSENE_TOKEN
  Use following command, using the dynamically given name from "heroku create".

  ```
  export LOGSENE_TOKEN=YOUR_LOGSENE_TOKEN
  heroku drains:add --app YOUR_HEROKU_MAIN_APPLICATION  `heroku info -s | grep web-url | cut -d= -f2`$LOGSENE_TOKEN
  ```
Now you can see your logs in Logsene, define Alert-Queries or use Kibana for Dashboards. 

3. Scale logagent-js service on Heroku

In case of high log volume, scale logagent-js  on demand using 
```
heroku scale web=3
```
#!/usr/bin/env bash
PLATFORM=$(uname)
SERVICE_NAME=logagent
INITD_SERVICE_FILE="/etc/init.d/logagent"
LAUNCHCTL_SERVICE_FILE="/Library/LaunchDaemons/com.sematext.logagent.plist"
SYSTEMD_SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
e=$'\e'
COLORblue="$e[0;36m"
COLORred="$e[0;31m"
COLORreset="$e[0m"
#nodeExecutable=`$(which node)||$(which nodejs)`
PATTERN="'/var/log/**/*.log'"
TOKEN=$1
while getopts ":i:u:g:" opt; do
  case $opt in
    u)
      export LOGSENE_RECEIVER_URL=$OPTARG
      #shift $((OPTIND-1))
      ;;
    i)
      export TOKEN=$OPTARG
      ;;
    g)
      export PATTERN="$OPTARG"
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      ;;
  esac
done

export LOGSENE_RECEIVER_URL=${LOGSENE_RECEIVER_URL:-https://logsene-receiver.sematext.com}
echo Set Logsene receiver url: $LOGSENE_RECEIVER_URL


function generate_upstart()
{
echo -e "description \"Sematext Logagent\"
start on runlevel [2345]
stop on runlevel [06]
respawn
chdir  /tmp
exec $1 --config $SPM_AGENT_CONFIG_FILE " > /etc/init/${SERVICE_NAME}.conf
runCommand "initctl reload-configuration"
stop $SERVICE_NAME 2> /dev/null
runCommand "start ${SERVICE_NAME}"
}

function generate_systemd() 
{
echo -e \
"
[Unit]
Description=Sematext Logagent
After=network.target

[Service]
Restart=always\nRestartSec=10
ExecStart=$1 --config $SPM_AGENT_CONFIG_FILE

[Install]
WantedBy=multi-user.target" > $SYSTEMD_SERVICE_FILE

echo "Service file $SERVICE_FILE:"
cat $SYSTEMD_SERVICE_FILE
runCommand "systemctl enable $SERVICE_NAME" 1
runCommand "systemctl stop $SERVICE_NAME " 2
runCommand "systemctl start $SERVICE_NAME" 3
sleep 1
runCommand "systemctl status $SERVICE_NAME" 4
runCommand "journalctl -n 10 -u $SERVICE_NAME" 5
}

function generate_initd() 
{
cat > /etc/init.d/logagent <<EOL
#!/bin/sh
### BEGIN INIT INFO
# Provides:          logagent
# Required-Start:    \$local_fs \$network \$named \$time \$syslog
# Required-Stop:     \$local_fs \$network \$named \$time \$syslog
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Description:       logagent
### END INIT INFO
NAME=logagent
PIDFILE=/var/run/\$NAME.pid
DAEMON=$1
DAEMON_OPTS="--config $SPM_AGENT_CONFIG_FILE"
export PATH="\${PATH:+\$PATH:}/usr/sbin:/sbin"
[ -f /etc/default/\$NAME ] && . /etc/default/\$NAME
is_running() {
    [ -f "\$PIDFILE" ] && ps \`cat \$PIDFILE\` > /dev/null 2>&1
}
start() {
  if is_running; then
    echo "Already started"
  else
    echo "Starting daemon: "\$NAME
    start-stop-daemon --start -q --no-close -m --oknodo -b -p \$PIDFILE -x \$DAEMON -- \$DAEMON_OPTS >> /var/log/\$NAME.log 2>&1
  fi
}
stop() {
  if is_running; then
    echo "Stopping daemon: \$NAME..."
    start-stop-daemon --stop --quiet --oknodo -p \$PIDFILE --retry 3
  else
    echo "\$NAME is not running"
  fi
}
case "\$1" in
  start)
        start
  ;;
  stop)
        stop
  ;;
  restart)
        echo  "Restarting daemon: "\$NAME
        stop
        start
  ;;
  status)
    if is_running; then
        echo "Running"
    else
        echo "Stopped"
        exit 1
    fi
  ;;
  *)
  echo "Usage: "\$1" {start|stop|restart|status}"
  exit 1
esac
exit 0
EOL
runCommand "chmod +x $INITD_SERVICE_FILE" 1
runCommand "update-rc.d logagent defaults" 2
runCommand "service logagent start" 3
sleep 2
runCommand "tail -n 10 /var/log/logagent.log" 4
}

function runCommand ()
{
  echo $2 $1
  $1
}

function generate_la_cfg() 
{
# make a backup of original config file 
if [ -e "$SPM_AGENT_CONFIG_FILE" ]; then  
  echo Config file ${SPM_AGENT_CONFIG_FILE} exists already, creating backup file "${SPM_AGENT_CONFIG_FILE}.bak"
  mv  $SPM_AGENT_CONFIG_FILE "${SPM_AGENT_CONFIG_FILE}.bak"
fi
if [ -e "$3" ]; then  
  echo Config file ${3} exists already, creating backup file "${3}.bak"
  mv  "$3" "${3}.bak"
fi

echo -e \
"
# Global options
options:
  # print stats every 60 seconds 
  printStats: 60
  # don't write parsed logs to stdout
  suppress: true
  # Enable/disable GeoIP lookups
  # Startup of logagent might be slower, when downloading the GeoIP database
  geoipEnabled: false
  # Directory to store Logagent status and temporary files
  # this is equals to LOGSNE_TMP_DIR env variable 
  diskBufferDir: /tmp/sematext-logagent

input:
  # a list of glob patterns to watch files to tail
  files:
    - $PATTERN

output:
  # index logs in Elasticsearch or Logsene
  elasticsearch: 
    module: elasticsearch
    url: $LOGSENE_RECEIVER_URL
    # default index (Logsene token) to use:
    index: $TOKEN
" > $SPM_AGENT_CONFIG_FILE
}

function generate_launchctl() 
{
echo -e \
"
<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\">
<dict>
    <key>EnvironmentVariables</key>
    <dict>
    <key>PATH</key>
     <string>/usr/local/bin/:$PATH</string>
    </dict>
    <key>Label</key>
    <string>com.sematext.logagent</string>
    <key>ProgramArguments</key>
    <array>
        <string>$1</string>
        <string>--config</string>
        <string>/etc/sematext/logagent.conf</string>
    </array>
    <key>StandardErrorPath</key>
          <string>/Library/Logs/logagent.log</string>
    <key>StandardOutPath</key>
        <string>/Library/Logs/logagent.log</string>
    <key>RunAtLoad</key>
          <true/>
</dict>
</plist>" > $LAUNCHCTL_SERVICE_FILE


echo "Service file $LAUNCHCTL_SERVICE_FILE:"
# cat $LAUNCHCTL_SERVICE_FILE
runCommand "launchctl unload -w -F $LAUNCHCTL_SERVICE_FILE" 1
runCommand "launchctl load -w -F $LAUNCHCTL_SERVICE_FILE" 2
runCommand "launchctl start com.sematext.logagent" 3
runCommand "tail -n 10 /Library/Logs/logagent.log" 4
}

function install_script ()
{
  export SPM_AGENT_CONFIG_FILE="/etc/sematext/logagent.conf"
  mkdir -p /etc/sematext
  
  echo "Create config file: $SPM_AGENT_CONFIG_FILE"
  generate_la_cfg $2 $3
  # echo "-s --logsene-tmp-dir /tmp -t $2 -g $3" > $SPM_AGENT_CONFIG_FILE
  runCommand "chown root $SPM_AGENT_CONFIG_FILE"
  runCommand "chmod 0600 $SPM_AGENT_CONFIG_FILE"
  cat $SPM_AGENT_CONFIG_FILE

  if [[ $PLATFORM = "Darwin" ]]; then
    echo "Generate launchd script ${LAUNCHCTL_SERVICE_FILE}"
    generate_launchctl $1 $2 $3
    return
  fi

  if [[ `/sbin/init --version` =~ upstart ]]>/dev/null  2>&1; then 
    echo "Generate upstart script ${UPSTART_SERVICE_FILE}"
    generate_upstart $1 $2  $3
    return
  fi
  if [[ `systemctl` =~ -\.mount ]]>/dev/null  2>&1; then 
    echo "Generate systemd script "
    generate_systemd $1 $2 $3
    return 
  fi
  if [[ `. /etc/os-release && echo $VERSION =~ wheezy` ]]; then
    echo "Generate init.d script"
    generate_initd $1 $2 $3
    return
  fi
}
command=$(which logagent)
echo $command
if [ -n "$TOKEN" ] ; then
  install_script $command $TOKEN "${PATTERN}";
else 
  echo "${COLORred}Missing paramaters. Usage:"
  echo `basename $0` "-i LOGSENE_TOKEN -g '/var/log/**/*.log' -u https://logsene-receiver.sematext.com"
  echo "Please obtain your application token for US region from https://apps.sematext.com/"
  echo "Please obtain your application token for EU region from https://apps.eu.sematext.com/"
  echo "For EU region use -u https://logsene-receiver.eu.sematext.com/$COLORreset"
  read -p "${COLORblue}Logsene Token: $COLORreset" TOKEN
  TOKEN=${TOKEN:-none}
  install_script $command $TOKEN $PATTERN;
fi 

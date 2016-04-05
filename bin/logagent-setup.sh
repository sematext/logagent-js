#!/usr/bin/env bash
PLATFORM=$(uname)
SERVICE_NAME=logagent
LAUNCHCTL_SERVICE_FILE="/Library/LaunchDaemons/com.sematext.logagent.plist"
SYSTEMD_SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
e=$'\e'
COLORblue="$e[0;36m"
COLORred="$e[0;31m"
COLORreset="$e[0m"
#nodeExecutable=`$(which node)||$(which nodejs)`

function generate_upstart()
{
echo -e "description \"Sematext Logagent\"
start on runlevel [2345]
stop on runlevel [06]
respawn
chdir  /tmp
exec $1 " > /etc/init/${SERVICE_NAME}.conf
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
ExecStart=$1

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

function runCommand ()
{
	echo $2 $1
	$1
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

echo "-s -t $2 -g $3" > $SPM_AGENT_CONFIG_FILE
runCommand "chown root $SPM_AGENT_CONFIG_FILE"
runCommand "chmod 0600 $SPM_AGENT_CONFIG_FILE"

echo "Create config file: $SPM_AGENT_CONFIG_FILE"
# cat $SPM_AGENT_CONFIG_FILE

	if [[ $PLATFORM = "Darwin" ]]; then
		echo "Generate launchd script ${LAUNCHCTL_SERVICE_FILE}"
		generate_launchctl $1 $2 $3
		return
	fi

	if [[ `/sbin/init --version` =~ upstart ]]>/dev/null; then 
		echo "Generate upstart script ${UPSTART_SERVICE_FILE}"
		generate_upstart $1 $2 	$3
		return
	fi
	if [[ `systemctl` =~ -\.mount ]]; then 
		echo "Generate systemd script "
		generate_systemd $1 $2 $3
		return 
	fi
}
command=$(which logagent)
echo $command
if [ -n "$1" ] ; then 
  token=$1
  install_script $command $token '/var/log/**/*.log';
else 
	echo "${COLORred}Missing paramaters. Usage:"
	echo `basename $0` "LOGSENE_TOKEN filepattern (/var/log/**/*.log)"
	echo "Please obtain your application token from https://apps.sematext.com/$COLORreset"
	read -p "${COLORblue}Logsene Token: $COLORreset" token
	token=${token:-none}
    install_script $command $token '/var/log/**/*.log';
fi 

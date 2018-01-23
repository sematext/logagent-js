#!/usr/bin/env bash
PLATFORM=$(uname)
SERVICE_NAME=logagent
CONFIG_FILE=/etc/sematext/logagent.conf
LAUNCHCTL_SERVICE_FILE="/Library/LaunchDaemons/com.sematext.logagent.plist"
SYSTEMD_SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
function runCommand ()
{
	echo $2 $1
	$1
}
function remove_config_and_npm_package()
{
echo "Removing configuration file ${CONFIG_FILE}"
runCommand "rm $CONFIG_FILE"
runCommand "rm /tmp/logagentTailPointers.json"
echo "Removing global npm package @sematext/logagent"
runCommand "npm rm @sematext/logagent"
}
function uninstall_logagent_service() 
{
if [[ $PLATFORM = "Darwin" ]]; then
	echo "Uninstall launchd script ${LAUNCHCTL_SERVICE_FILE}"
	runCommand "launchctl stop com.sematext.${SERVICE_NAME}" 1
	runCommand "launchctl unload -w -F $LAUNCHCTL_SERVICE_FILE" 1
	runCommand "rm $LAUNCHCTL_SERVICE_FILE"
	runCommand "rm /Library/Logs/${SERVICE_NAME}.log"
	remove_config_and_npm_package
	return
fi

if [[ `/sbin/init --version` =~ upstart ]]>/dev/null; then 
	echo "Uninstall upstart service ${SERVICE_NAME}"
	runCommand "stop ${SERVICE_NAME}"
	runCommand "rm /etc/init/${SERVICE_NAME}.conf"
	runCommand "initctl reload-configuration"
	remove_config_and_npm_package
	return
fi
if [[ `systemctl` =~ -\.mount ]]; then 
	echo "Uninstall systemd service for ${SERVICE_NAME}"
	runCommand "systemctl stop ${SERVICE_NAME}"
	runCommand "systemctl disable ${SERVICE_NAME}"
	runCommand "rm ${SYSTEMD_SERVICE_FILE}"
	remove_config_and_npm_package
	return 
fi
}
uninstall_logagent_service

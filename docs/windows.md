# Installation on windows

1) Download and install node

Download nodejs from [nodejs.org](https://nodejs.org/en/download/) and execute the installer. 

2) Install Logagent and windows event plugin

```
npm i -g @sematext/logagent
npm i -g logagent-input-windows-events
# run logagent windows version 
logagent-windows --help 
```

3) Optional service installer

Create a configuration file for Logagent in 
```
%ProgramData%\Sematext\logagent.conf
```  
(default: c:\ProgramData\sematext\logagent.conf)

In case you want to store the configuration file in a different directory, enter the new location in the registry:

```
HKEY_LOCAL_MACHINE\System\CurrentControlSet\Control\Session Manager\Environment\LOGAGENT_CONFIG
```

Example config file to collect Windows events to Elasticsearch: 

```
options:
  includeOriginalLine: false
  suppress: true

input:
  windowsEvent:
    module: logagent-input-windows-events 
    # query events every 10 seconds
    interval: 10
    maxEvents: 1000

output:  
  local-es:
    module: elasticsearch
    url: http://localhost:9200
    index: windows_events
```

Run service installer: 


```
logagent-windows -install
```

To uninstall the service run 

```
logagent-windows -uninstall
```







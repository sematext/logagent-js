# Grep Input Filter

Apply regex to filter raw input from @sematext/logagent before logs are parsed

# Configuration 

Add following section to @sematext/logagent configuration file. Please note you could use the plugin with multiple configurations. Output of the first filter is passed into the next one ...: 

```
input: 
  files:
    - '/var/log/**/*.log'

inputFilter:
  - module: grep
    config:
      matchSource: !!js/regexp /myapp.log/
      include: !!js/regexp /info|error/i
      exclude: !!js/regexp /test/i

output:
  elasticsearch:
    url: http://localhost:9200
    index: mylogs

```

The example above filters all log files with the content "info" or "error", and drops all lines with the keyword "test". 

Run logagent: 
```
logagent --config myconfig.yml 
```

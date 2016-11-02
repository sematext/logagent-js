# Plugin: TCP input

Plugin to receive log data via TCP.
Optionally it can send parsed JSON back to the client. 

## Configuration

```
input:
  tcp: 
    module: input-tcp
    port: 45900
    bindAddress: 0.0.0.0
    sourceName: tcpTest
    returnResult: false

output:
  elasticsearch:
    url: http://localhost:9200
    index: logs
```

Start logagent

```
logagent --config myconfig.yml
```

Ship logs to the tcp port:

```
tail -F  access.log |  nc localhost 45900
``` 

Install logagent as local module and save the dependency to your package.json

```
npm i logagent-js --save
```

Use the Logparser module in your source code

``` 
var Logparser = require('logagent-js')
var lp = new Logparser('./patterns.yml')
lp.parseLine('log message', 'source name', function (err, data) {
    if(err) {
      console.log('line did not match with any pattern')
    }
    console.log(JSON.stringify(data))
})
```

To test patterns or convert logs from text to JSON use the command line tool 'logagent'. It reads from stdin and outputs line delimited JSON (or pretty JSON or YAML) to the console. In addtion it can forward the parsed objects directly to [Logsene](http://sematext.com/logsene).

Test your patterns:
```
cat myapp.log | bin/logagent -y -n myapp -f mypatterns.yml
```

# Plugin: Microsoft SQL Input

Input plugin to use Microsoft SQL queries as input and stream the output into logagent.

Features:

- run queries frequently
- choose timezone and format for query time
- use multiple SQL query statements 

Applications:

- index for SQL data in elasticsearch
- create alerts based SQL data

## Configuration

```

input:
  mssql:
    module: mssql-query
    connectioninfo: 
      server: localhost
      port: 1433
      userName: Testuser
      password: Testpassword
      database: testdatabase
      options: 
        database: testdatabase
        #encrypt: true
        #rowCollectionOnDone: true
        rowCollectionOnRequestCompletion: true
    queryTimezone: America/Los_Angeles 
    queryTimeFormat: YYYY-MM-DD HH:mm:ss
    queries: 
      - sourceName: query1
        sql:  SELECT * FROM employees
    interval: 1
    debug: true

output:
    stdout: yaml

```

Start logagent

```
logagent --config mssql.yaml
```

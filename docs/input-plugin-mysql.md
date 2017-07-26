# Plugin: MySQL Input

Input plugin to use my sql queries as input and stream the output into logagent.

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
  mysql-json:
    module: mysql-query
    server: 
      host: 'localhost'
      port: '6603'
      user: 'root'
      password: ''
      database: 'test'
    queryTimezone: America/Los_Angeles 
    queryTimeFormat: YYYY-MM-DD HH:mm:ss  
    queries: 
      - sourceName: query1
        sql: SELECT * FROM potluck where signup_date < '$queryTime'
      - sourceName: query2      
        sql: SELECT * FROM potluck where name = 'Tina' and signup_date < '$queryTime'
      - sourceName: query3
        sql: SELECT * FROM potluck where name = 'Sandy' and signup_date < '$queryTime'
    interval: 1
    debug: true

output:
    stdout: yaml

```

Start logagent

```
logagent --config mysql.yaml
```

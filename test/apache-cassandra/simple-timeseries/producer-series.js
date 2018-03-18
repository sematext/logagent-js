'use strict'
const cassandra = require('cassandra-driver')
const client = new cassandra.Client({ contactPoints: ['127.0.0.1']})
const INSERT_QUERY = 'INSERT INTO logagent.orders_by_day(order_number,date,event_time,amount) VALUE (?,?,?,?)'

    
    
//     INSERT INTO orders_by_day(order_number,date,event_time,amount)
//     VALUES (’1234ABCD’,’2018-04-03′,’2013-04-03 07:01:00′,’2000€’);
    
//     INSERT INTO orders_by_day(order_number,date,event_time,amount)
//     VALUES (’1234ABCD’,’2018-04-03′,’2013-04-03 07:02:00′,’6500€’);
    
//     INSERT INTO orders_by_day(order_number,date,event_time,amount)
//     VALUES (’1234ABCD’,’2018-04-04′,’2013-04-04 07:01:00′,’4000€’);
    
//     INSERT INTO orders_by_day(order_number,date,event_time,amount)
//     VALUES (’1234ABCD’,’2018-04-04′,’2013-04-04 07:02:00′,’6500€’);

client.connect()
  .then(function () {
    const query = "CREATE KEYSPACE IF NOT EXISTS logagent WITH replication = {'class': 'SimpleStrategy', 'replication_factor': '1' }"
    return client.execute(query)
  })
  .then(function () {
    const query = "CREATE TABLE  IF NOT EXISTS logagent.orders_by_day (order_number text,date text, event_time timestamp,amount text,PRIMARY KEY ((order_number,date),event_time))"
    return client.execute(query)
  })
  .then(function () {
    console.log('try to insert data')
    return client.execute(INSERT_QUERY,['201803030AEDFG','2018-04-03','2013-04-03 07:01:00','2000€'],{ traceQuery: true})
  })
  .then(function (result) {
    const order_number = result.info.order_number
    return client.metadata.getTrace(order_number)
  })
  .then(function (trace) {
    console.log('Trace for the execution of the query:')
    console.log(trace)
    console.log('The trace was retrieved successfully')
    client.shutdown()
  })
  .catch(function (err) {
    console.error('There was an error', err)
    return client.shutdown()
  })


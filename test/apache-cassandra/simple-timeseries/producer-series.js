'use strict'
const cassandra = require('cassandra-driver')
const client = new cassandra.Client({ contactPoints: ['127.0.0.1']})
const INSERT_QUERY = 'INSERT INTO logagent.orders_by_day(order_number,date,event_time,amount) VALUES (?,?,?,?)'

const queries = [
  {
    query: 'INSERT INTO logagent.orders_by_day(order_number,date,event_time,amount) VALUES (?,?,?,?)',
    params: ['1234ABCD','2018-03-02','2018-03-02 07:01:00','2000€']
  },
  {
    query: 'INSERT INTO logagent.orders_by_day(order_number,date,event_time,amount) VALUES (?,?,?,?)',
    params: ['45678ABCD','2018-03-02','2018-03-02 09:01:00','6500€']
  },
  {
    query: 'INSERT INTO logagent.orders_by_day(order_number,date,event_time,amount) VALUES (?,?,?,?)',
    params: ['6666ABCD','2018-03-03','2018-03-03 07:01:00','3445€']
  },
  {
    query: 'INSERT INTO logagent.orders_by_day(order_number,date,event_time,amount) VALUES (?,?,?,?)',
    params: ['9999ABCD','2018-03-03','2018-03-03 09:01:00','2345€']
  },
]


client.connect()
  .then(function () {
    const query = "CREATE KEYSPACE IF NOT EXISTS logagent WITH replication ={'class': 'SimpleStrategy', 'replication_factor': '3' }"
    return client.execute(query)
  })
  .then(function () {
    const query = "CREATE TABLE  IF NOT EXISTS logagent.orders_by_day (order_number text,date text, event_time timestamp,amount text,PRIMARY KEY ((order_number,date),event_time))"
    return client.execute(query)
  })
  .then(function () {
    console.log('in')
    //const params = ['2018044000AEEFG','2018-05-03','2013-04-03 07:01:00','2000€']
    return client.execute(queries,{ prepare: true})
    //return client.execute(INSERT_QUERY,params,{ prepare: true})
  })
  .then(function() {
    const params = ['2018044000AEEFG', '2018-05-03']
    const QUERY = 'SELECT * FROM logagent.orders_by_day WHERE order_number= ? AND date= ?'
    return client.execute(QUERY,params,{ prepare: true})
  })
  .then(function (result) {
    console.log('result ' + JSON.stringify(result))
    client.shutdown()

  })
  .catch(function (err) {
    console.error('There was an error', err)
    return client.shutdown()
  })


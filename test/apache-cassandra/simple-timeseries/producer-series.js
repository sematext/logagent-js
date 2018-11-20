'use strict'
const cassandra = require('cassandra-driver')
const client = new cassandra.Client({ contactPoints: ['127.0.0.1']})
const INSERT_QUERY = 'INSERT INTO logagent.orders_by_day(order_number,date,event_time,amount) VALUES (?,?,?,?)'

client.connect()
  .then(function () {
    const query = "CREATE KEYSPACE IF NOT EXISTS logagent WITH replication ={'class': 'SimpleStrategy', 'replication_factor': '1' }"
    return client.execute(query)
  }).then(function () {
  console.log('drop table')
  const query = 'DROP TABLE IF EXISTS logagent.orders_by_day'
  return client.execute(query)
})
  .then(function () {
    const query = 'CREATE TABLE  IF NOT EXISTS logagent.orders_by_day (order_number text,date text, event_time timestamp,amount text, PRIMARY KEY ((order_number,event_time),date))'
    return client.execute(query)
  })
  .then(function () {
    console.log('row1')
    const params = ['2018044000AEEFG', '2017-04-03', '2017-04-03 07:01:00', '2000€']
    return client.execute(INSERT_QUERY, params, { prepare: true})
  }).then(function () {
  console.log('row2')
  const params = ['2018044000AEEFG', '2017-04-02', '2017-04-02 09:01:00', '3000€']
  return client.execute(INSERT_QUERY, params, { prepare: true})
}).then(function () {
  console.log('row3')
  const params = ['2018044000AEEFG', '2017-05-03', '2017-05-03 07:01:00', '6500€']
  return client.execute(INSERT_QUERY, params, { prepare: true})
}).then(function () {
  console.log('row4')
  const params = ['2018044000AEEFG', '2017-05-03', '2017-05-03 10:01:00', '4500€']
  return client.execute(INSERT_QUERY, params, { prepare: true})
}).then(function () {
  const params = ['2017-05-02 06:01:00']
  const QUERY = 'SELECT * FROM logagent.orders_by_day WHERE event_time>= ? ALLOW FILTERING'

  return client.execute(QUERY, params, { prepare: true})
})
  .then(function (result) {
    console.log('result ' + JSON.stringify(result))
    client.shutdown()
  })
  .catch(function (err) {
    console.error('There was an error', err)
    return client.shutdown()
  })

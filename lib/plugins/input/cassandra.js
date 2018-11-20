'use strict'
const cassandra = require('cassandra-driver')
const momenttz = require('moment-timezone')
const consoleLogger = require('../../util/logger.js')
const distance = cassandra.types.distance

function InputCassandra (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  this.started = false
  var distanceLocal = config.pooling.coreConnectionsPerHost.distanceLocal
  var distanceRemote = config.pooling.coreConnectionsPerHost.distanceRemote

  var contatPoints = config.server.host.split(',')
  this.client = new cassandra.Client({ contactPoints: contatPoints, keyspace: config.server.keyspace, pooling: {coreConnectionsPerHost: { [distance.local]: distanceLocal, [distance.remote]: distanceRemote} } })
  if (this.config.interval < 1) {
    this.config.interval = 1
  }
}

InputCassandra.prototype.queryResultCb = function (err, result) {
  if (!err) {
    if (this.debug) {
      consoleLogger.error(this.context.queryTime, this.context.sourceName + ': ' + this.context.sql)
    }
    var rows = result.rows
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i]['@timestamp']) {
        rows[i]['@timestamp'] = new Date()
      }
      rows[i].logSource = this.context.sourceName
      this.eventEmitter.emit('data.parsed', rows[i], this.context)
    }
  } else {
    this.eventEmitter.emit('error', err)
  }
}
InputCassandra.prototype.runQuery = function () {
  if (!this.queryTime) {
    this.queryTime = new Date()
  }
  for (var i = 0; i < this.config.queries.length; i++) {
    var dateString = this.queryTime.toISOString().slice(0, 19).replace('T', ' ')
    if (this.config.queryTimezone && this.config.queryTimeFormat) {
      dateString = momenttz(this.queryTime).tz(this.config.queryTimezone).format(this.queryTimeFormat)
    }
    // var testDate = '2017-05-02 06:01:00'
    var tmpSqlStatement = this.config.queries[i].sql.replace(/\$queryTime/g, dateString)
    var tmpSqlStatement = this.config.queries[i].sql.replace(/\$queryTime/g, testDate)
    var context = {sourceName: this.config.queries[i].sourceName, sql: tmpSqlStatement, queryTime: this.queryTime}
    this.queryTime = new Date()
    this.query(tmpSqlStatement, this.queryResultCb.bind({eventEmitter: this.eventEmitter, context: context, debug: this.config.debug}))
  }
}

InputCassandra.prototype.start = function () {
  if (!this.started) {
    this.started = true
    this.intervalID = setInterval(this.runQuery.bind(this), this.config.interval * 1000)
  }
}

InputCassandra.prototype.stop = function () {
  if (this.started) {
    this.started = false
    clearInterval(this.intervalID)
    this.client.shutdown
  }
}

InputCassandra.prototype.query = function (csql, cb) {
  var self = this
  self.client.connect()
    .then(function () {
      return self.client.execute(csql, { prepare: true})
    }).then(function (result) {
    cb(null, result)
  }).catch(function (err) {
    console.error('error query', err)
    return
  })
}

module.exports = InputCassandra

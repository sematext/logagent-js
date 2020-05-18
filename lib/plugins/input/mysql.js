'use strict'
var mysql = require('mysql')
var momenttz = require('moment-timezone')
function InputMySql (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  this.started = false
  this.connection = mysql.createConnection(config.server)
  if (this.config.interval < 1) {
    this.config.interval = 1
  }
}

InputMySql.prototype.queryResultCb = function (err, rows) {
  if (!err) {
    if (this.debug) {
      console.error(
        this.context.queryTime,
        this.context.sourceName + ': ' + this.context.sql
      )
    }
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i]['@timestamp']) {
        rows[i]['@timestamp'] = new Date()
      }
      rows[i].logSource = this.context.sourceName
      this.eventEmitter.emit('data.object', rows[i], this.context)
    }
  } else {
    this.eventEmitter.emit('error', err)
  }
}
InputMySql.prototype.runQuery = function () {
  if (!this.queryTime) {
    this.queryTime = new Date()
  }
  for (var i = 0; i < this.config.queries.length; i++) {
    var dateString = this.queryTime
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ')
    if (this.config.queryTimezone && this.config.queryTimeFormat) {
      dateString = momenttz(this.queryTime)
        .tz(this.config.queryTimezone)
        .format(this.queryTimeFormat)
    }
    var tmpSqlStatement = this.config.queries[i].sql.replace(
      /\$queryTime/g,
      dateString
    )
    var context = {
      sourceName: this.config.queries[i].sourceName,
      sql: tmpSqlStatement,
      queryTime: this.queryTime
    }
    this.queryTime = new Date()
    this.query(
      tmpSqlStatement,
      this.queryResultCb.bind({
        eventEmitter: this.eventEmitter,
        context: context,
        debug: this.config.debug
      })
    )
  }
}

InputMySql.prototype.start = function () {
  if (!this.started) {
    this.started = true
    this.intervalID = setInterval(
      this.runQuery.bind(this),
      this.config.interval * 1000
    )
  }
}

InputMySql.prototype.stop = function () {
  if (this.started) {
    this.started = false
    clearInterval(this.intervalID)
  }
}
InputMySql.prototype.query = function (sql, cb) {
  var self = this
  self.connection.query(sql, function (err, rows, fields) {
    if (err) {
      cb(err)
      return
    }
    cb(null, rows)
  })
}

module.exports = InputMySql

'use strict'
var Connection = require('tedious').Connection
var Request = require('tedious').Request
var momenttz = require('moment-timezone')
var consoleLogger = require('../../util/logger.js')
function InputMSSql (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  this.started = false
  this.connection = new Connection(config.connectioninfo)
  if (this.config.interval < 1) {
    this.config.interval = 1
  }
}

InputMSSql.prototype.queryResultCb = function (err, rows) {
  if (this.debug) {
    consoleLogger.log(this.context.sourceName + ': ' + this.context.sql)
  }
  if (!err) {
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i]['@timestamp']) {
        rows[i]['@timestamp'] = new Date()
      }
      rows[i].logSource = this.context.sourceName
      var record = {}
      var currentRow = rows[i]
      for (var col = 0; col < currentRow.length; col++) {
        var colName = currentRow[col].metadata.colName
        record[colName] = currentRow[col].value
      }
      this.eventEmitter.emit('data.parsed', record, this.context)
    }
  } else {
    this.eventEmitter.emit('error', err)
  }
}

InputMSSql.prototype.runQuery = function () {
  if (!this.queryTime) {
    this.queryTime = new Date()
  }
  for (var i = 0; i < this.config.queries.length; i++) {
    var dateString = this.queryTime.toISOString().slice(0, 19).replace('T', ' ')
    if (this.config.queryTimezone && this.config.queryTimeFormat) {
      dateString = momenttz(this.queryTime).tz(this.config.queryTimezone).format(this.queryTimeFormat)
    }
    var tmpSqlStatement = this.config.queries[i].sql.replace(/\$queryTime/g, dateString)
    var context = {sourceName: this.config.queries[i].sourceName, sql: tmpSqlStatement, queryTime: this.queryTime}
    this.queryTime = new Date()
    this.query(tmpSqlStatement, this.queryResultCb.bind({eventEmitter: this.eventEmitter, context: context, debug: this.config.debug}))
  }
}

InputMSSql.prototype.start = function () {
  if (!this.started) {
    this.started = true
    this.intervalID = setInterval(this.runQuery.bind(this), this.config.interval * 1000)
  }
}

InputMSSql.prototype.stop = function () {
  if (this.started) {
    this.started = false
    clearInterval(this.intervalID)
  }
}

InputMSSql.prototype.query = function (sql, cb) {
  var self = this
  var request = new Request(sql, function (err, rowCount, rows) {
    console.log(rows)
    if (err) {
      cb(err)
      return
    }
    cb(null, rows)
  })
  request.on('doneProc', function (rowCount, more, rows) {})
  self.connection.execSql(request)
}

module.exports = InputMSSql

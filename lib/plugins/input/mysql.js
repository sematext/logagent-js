'use strict'
var mysql = require('mysql')
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
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i]['@timestamp']) {
        rows[i]['@timestamp'] = new Date()
      }
      this.eventEmitter.emit('data.parsed', rows[i], this.context)
    }
  } else {
    this.eventEmitter.emit('error', err)
  }
}

InputMySql.prototype.runQuery = function () {
  if (!this.queryTime) {
    this.queryTime = new Date()
  }
  this.context = {sourceName: this.config.sourceName || this.config.sql}
  var newSqlStatement = this.config.sql.replace(/\$queryTime/g, this.queryTime.toISOString().slice(0, 19).replace('T', ' '))
  if (this.config.debug) {
    console.error('SQL: ' + newSqlStatement)
  }
  this.queryTime = new Date()
  this.query(newSqlStatement, this.queryResultCb.bind(this))
}
InputMySql.prototype.start = function () {
  if (!this.started) {
    this.started = true
    this.intervalID = setInterval(this.runQuery.bind(this), this.config.interval * 1000)
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

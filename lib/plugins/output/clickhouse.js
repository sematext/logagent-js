'use strict'
// var ClickHouse = require('clickhouse')
const { ClickHouse } = require('clickhouse')
var consoleLogger = require('../../util/logger.js')

function ClickHouseOutput (config, eventEmitter) {
  this.config = config.configFile.output.clickhouse
  this.eventEmitter = eventEmitter
  var chOptions = {
    url: this.config.url || 'http://localhost',
    port: this.config.port || 8123,
    debug: this.config.debug || false
  }
  if (this.config.user) {
    chOptions.user = this.config.user
  }
  if (this.config.password) {
    chOptions.password = this.config.password
  }
  if (this.config.basicAuth !== undefined) {
    chOptions.basicAuth = this.config.basicAuth
  }
  if (this.config.database !== undefined) {
    chOptions.config = { database: this.config.database }
  }
  if (this.config.useGzip !== undefined) {
    chOptions.isUseGzip = this.config.useGzip
  }

  this.ch = new ClickHouse(chOptions)
  if (this.config.debug) {
    var cfg = this.config
    delete cfg.configFile
    consoleLogger.log(JSON.stringify(config))
  }
  this.fields = this.config.fields
  this.table = this.config.table
  this.data = []
  this.ws = this.ch.insert('INSERT INTO ' + this.table).stream()
  this.ws.on('error', console.error)
}

ClickHouseOutput.prototype.eventHandler = function (data, context) {
  
  var record = []
  Object.keys(this.fields).forEach(function (value) {
    if (this.fields[value] === '@timestamp') {
      record.push(data[this.fields[value]].getTime())
    } else {
      record.push(data[this.fields[value]] || null)
    }
  }.bind(this))
  this.ws.on('error', console.log)
  this.ws.writeRow(record)
  this.ws.exec()
  this.ws = this.ch.insert('INSERT INTO ' + this.table).stream()
  this.ws.on('error', console.error)
}

ClickHouseOutput.prototype.start = function () {
  this.eventEmitter.on('data.parsed', this.eventHandler.bind(this))
}

ClickHouseOutput.prototype.stop = function (cb) {
  this.eventEmitter.removeListener('data.parsed', this.eventHandler)
  cb()
}

module.exports = ClickHouseOutput

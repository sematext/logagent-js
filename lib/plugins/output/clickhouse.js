'use strict'
// var ClickHouse = require('clickhouse')
const { ClickHouse } = require('clickhouse')
function ClickHouseOutput (config, eventEmitter) {
  this.config = config.configFile.output.clickhouse
  this.eventEmitter = eventEmitter
  this.ch = new ClickHouse({
    url: this.config.url || 'http://localhost',
    port: this.config.port || 8123,
    debug: this.config.debug || false
  })
  console.log(config)
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
}

ClickHouseOutput.prototype.start = function () {
  this.eventEmitter.on('data.parsed', this.eventHandler.bind(this))
}

ClickHouseOutput.prototype.stop = function (cb) {
  this.eventEmitter.removeListener('data.parsed', this.eventHandler)
  cb()
}

module.exports = ClickHouseOutput

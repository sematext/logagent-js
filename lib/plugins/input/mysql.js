'use strict'
var mysql = require('mysql')

function InputMySql (config, eventEmitter) { 
  this.config = config 
  this.eventEmitter = eventEmitter
  this.started = false
  this.connection = mysql.createConnection(config.server)
  if (this.config.interval <= 1) {
      this.config.interval = 1
  }
}

InputMySql.prototype.start = function () {
  if (!this.started) {
    this.started = true
    this.intervalID = setInterval(function() {
        var context = {sourceName: this.config.sourceName || this.config.sql}
        this.query(this.config.sql, 
        function (err, rows) {
            if (!err) {
              for(var i = 0; i < rows.length; i++) {
                rows[i]['@timestamp'] = new Date()
                this.eventEmitter.emit('data.parsed', rows[i], context)
              }
            } else {
              this.eventEmitter.emit('error', err)  
            }
        }.bind(this))
    }.bind(this), this.config.interval * 1000)
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

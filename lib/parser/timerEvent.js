var event = require('events').EventEmitter
var util = require('util')
function evt (options) {
  this.interval = options.interval || 5000
  this.event = options.event
  this.handle = null
  this.setMaxListeners(1000)
}
util.inherits(evt, event)
evt.prototype.start = function () {
  if (this.event && this.interval === parseInt(this.interval, 10)) {
    var self = this
    var timer = function () {
      self.emit(self.event)
    }
    self.handle = setInterval(timer, self.interval)
  } else {
    this.emit(
      'error',
      new Error('"events" is not an array and/or "interval" is not an integer')
    )
  }
}
evt.prototype.stop = function () {
  clearTimeout(this.handle)
  this.handle = null
}

evt.prototype.reinit = function (interval) {
  this.stop()
  this.interval = interval
  this.start()
}

module.exports = evt

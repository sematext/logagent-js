'use strict'
function MultiLine (delimiter, cbf) {
  this.opt = {
    delimiter: delimiter,
    timeout: 300
  }
  this.lines = []
  this.state = 0
  this.consumer = cbf
  this.tid = 0
  if (delimiter) {
    this.tid = setInterval(function lineTimeout() {
      if (this.lines.length > 0 && (new Date().getTime() - this.lastCall.getTime()) > this.opt.timeout) {
        this.consumer(this.lines.join('\n'))
        this.lines.length = 0
        this.state = 0
      }
    }.bind(this), 310)
    if(this.tid.unref) {
      this.tid.unref()
    }
  }
}

MultiLine.prototype.intervalHandler = function () {}

MultiLine.prototype.add = function (line) {
  if (!this.opt.delimiter) {
    return this.consumer(line)
  }
  this.lastCall = new Date()
  if (this.lines.length === 0) {
    this.lines.push(line)
  } else { // reading in block
    if (this.opt.delimiter.test(line)) {
      this.consumer(this.lines.join('\n'))
      this.lines.length = 0
      this.lines.push(line)
    } else {
      this.lines.push(line)
    }
  }
}

module.exports = MultiLine

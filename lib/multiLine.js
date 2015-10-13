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
  var self = this
  if (delimiter) {
    setInterval(function () {
      if (self.lines.length > 0 && (new Date().getTime() - self.lastCall.getTime()) > self.opt.timeout) {
        self.consumer(self.lines.join('\n'))
        self.lines.length = 0
        self.state = 0
      }
    }, 310)
  }
}

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

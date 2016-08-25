'use strict'
var consoleLogger = require('../util/logger.js')
function formatObject (o) {
  var rv = ''
  Object.keys(o).forEach(function (key) {
    rv = rv + ' ' + key + '=' + o[key]
  })
  return rv
}

function StatsPrinter () {
  this.begin = new Date().getTime()
  this.count = 0
  this.logsShipped = 0
  this.httpFailed = 0
  this.emptyLines = 0
  this.bytes = 0
  this.retransmit = 0
  this.usedTokens = []
}

StatsPrinter.prototype.printStats = function () {
  var self = this
  var now = new Date().getTime()
  var duration = now - self.begin
  var throughput = this.count / (duration / 1000)
  var throughputBytes = (self.bytes / 1024 / 1024) / (duration / 1000)
  var logStatsMsg = formatObject({
    usedTokens: self.usedTokens.length,
    shippedLogs: self.logsShipped,
    httpFailed: self.httpFailed,
    httpRetransmit: self.retransmit,
    throughputLinesPerSecond: throughput.toFixed(0)
  })
  var memStats = formatObject({
    heapUsedMB: (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(0),
    heapTotalMB: (process.memoryUsage().heapTotal / (1024 * 1024)).toFixed(0),
    memoryRssMB: (process.memoryUsage().rss / (1024 * 1024)).toFixed(0)
  })
  consoleLogger.log('Logagent report: pid[' + process.pid + ']' + ' ' + duration + ' ms ' + this.count + ' lines parsed.  ' + throughput.toFixed(0) + ' lines/s ' + throughputBytes.toFixed(3) + ' MB/s - empty lines: ' + this.emptyLines)
  consoleLogger.log('Logagent stats:' + logStatsMsg)
  consoleLogger.log('Memory stats: ' + memStats)
  this.begin = now
  this.count = 0
  this.bytes = 0
  this.logsShipped = 0
  this.httpFailed = 0
  this.retransmit = 0
  this.tokens = []
  var fileManager = this.fileManger
  if (fileManager) {
    var msg = formatObject(fileManager.stats)
    if (msg) {
      consoleLogger.log('Lines read: ' + msg)
    }
    Object.keys(fileManager.stats).forEach(function (file) {
      fileManager.stats[file] = 0
    })
  }
}

module.exports = new StatsPrinter()

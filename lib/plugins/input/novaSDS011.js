'use strict'
var SDS011Wrapper = require('sds011-wrapper')
var sensor = null
var stringify = require('fast-safe-stringify')
var EE = require('events')
function NovaSDS011 (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  // listen to location events from apple-device-tracker plugin
  eventEmitter.on('location', function (location) {
    this.location = location
  }.bind(this))
}

NovaSDS011.prototype.start = function () {
  var self = this
  sensor = new SDS011Wrapper(this.config.comPort || '/dev/cu.wchusbserialfa1220')
  Promise
    .all([sensor.setReportingMode('active'), sensor.setWorkingPeriod(0)])
    .then(() => {
      sensor.on('measure', (data) => {
        if (self.location && self.location.geoip) {
          data.geoip = self.location.geoip
        }
        eventEmitter.emit('data.raw', stringify(data), context)
      })
    })

  var context = {name: 'input.NovaSDS011', sourceName: this.config.sourceName || 'unknown'}
  var eventEmitter = this.eventEmitter
}

NovaSDS011.prototype.stop = function (cb) {
  console.log('stop')
  sensor.stop()
  cb()
}

module.exports = NovaSDS011

function test () {
  var ee = new EE()
  var p = new NovaSDS011({
    comPort: '/dev/cu.wchusbserialfa1220'
  }, ee)
  ee.on('data', console.log)
  p.start()
  process.on('beforeExit', function () {
    p.stop(function () {
      console.log('stop')
    })
  })
}

if (require.main === module) {
  test()
}

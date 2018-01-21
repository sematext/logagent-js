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
  var context = {name: 'input.NovaSDS011', sourceName: this.config.sourceName || 'NovaSDS011'}
  var eventEmitter = this.eventEmitter
  try {
    sensor = new SDS011Wrapper(this.config.comPort || '/dev/cu.wchusbserialfa1220')
  } catch (err) {
    console.error(error.toString())
    throw err
    return
  }
  Promise
    .all([sensor.setReportingMode('active'), sensor.setWorkingPeriod(0)])
    .then(() => {
      sensor.on('measure', (data) => {
        if (self.location && self.location.geoip) {
          data.geoip = self.location.geoip
        }
        data.logSource = context.sourceName
        eventEmitter.emit('data.raw', stringify(data), context)
      })
    })
    .catch(() => {

    })
}

NovaSDS011.prototype.stop = function (cb) {
  sensor.close()
  cb()
}

module.exports = NovaSDS011

function test () {
  var ee = new EE()
  var p = new NovaSDS011({
    comPort: '/dev/cu.wchusbserial1420'
  }, ee)
  ee.on('data.raw', console.log)
  p.start()
  process.on('beforeExit', function () {
    p.stop(function () {
      console.log('stop')
    })
  })
  setTimeout(p.stop, 60000)
}

if (require.main === module) {
  test()
}

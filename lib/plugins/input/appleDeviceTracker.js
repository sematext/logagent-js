'use strict'
// var SDS011Wrapper = require("sds011-wrapper")
var sensor = null
var stringify = require('fast-safe-stringify')
var icloud = require('find-my-iphone').findmyphone
var consoleLogger = require('../../util/logger.js')

function AppleDeviceTracker (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  icloud.apple_id = process.env.APPLE_ID || this.config.appleId
  icloud.password = process.env.APPLE_PW || this.config.applePassword
}

AppleDeviceTracker.prototype.getLocation = function () {
  var eventEmitter = this.eventEmitter
  var config = this.config
  icloud.getDevices(function (error, devices) {
    if (error) {
      return error
    }
    devices.forEach(function (d) {
      if (config.ignoreDeviceName) {
        var idn = new RegExp(config.ignoreDeviceName)
        if (idn.test(d.name) || idn.test(d.deviceDisplayName)) {
          if (config.debug) {
            consoleLogger.log('ignoring device ' + config.ignoreDeviceName + ': ' + d.name + ' ' + d.deviceDisplayName)
          }
          return null
        }
      }
      if (config.filterDeviceName) {
        var fdn = new RegExp(config.filterDeviceName)
        if (!(fdn.test(d.name) || fdn.test(d.deviceDisplayName))) {
          if (config.debug) {
            consoleLogger.log('filter did not match' + config.filterDeviceName + ': ' + d.name + ' ' + d.deviceDisplayName)
          }
          return null
        }
      }
      var device = null
      if (d.location /* && d.lostModeCapable */) {
        device = d
      } else {
        device = null
        return
      }
      if (d.location) {
        icloud.getLocationOfDevice(device, function (err, location) {
          if (err) {
            return consoleLogger.error(err)
          }
          device.geoip = {
            location: [device.location.longitude, device.location.latitude]
          }
          device.message = device.name +
            ' (' + device.modelDisplayName + '): ' + location
          if (location) {
            device.location.address = location
          } else {
            device.message = device.name +
            ' (' + device.modelDisplayName + '): ' + device.location.latitude + ',' + device.location.longitude +
            ', https://www.google.de/maps/search/maps+' + device.location.latitude + ',' + device.location.longitude
          }
          eventEmitter.emit('location', {geoip: device.geoip, address: location}, {sourceName: 'icloud'})
          if (!config.emitOnlyLocationEvent) {
            eventEmitter.emit('data.raw', stringify(device), {sourceName: 'icloud'})
          }
          if (config.debug) {
            consoleLogger.debug(stringify(device))
          }
        })
      } else {
        // consoleLogger.log(d.displayName)
      }
    })
  })
}

AppleDeviceTracker.prototype.start = function () {
  var self = this
  var gl = this.getLocation.bind(this)
  setInterval(function () {
    gl()
  }, 1000 * 60 * (self.config.interval || 1))
  gl()
}

AppleDeviceTracker.prototype.stop = function (cb) {
  cb()
}

module.exports = AppleDeviceTracker

function test () {
  var EE = require('events')
  var p = new AppleDeviceTracker({
    appleId: process.env.APPLE_ID,
    applePassword: process.env.APPLE_PW,
    debug: true
  }, new EE())
  p.start()
}

if (require.main === module) {
  test()
}

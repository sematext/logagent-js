const publicIp = require('public-ip')
const consoleLogger = require('../../util/logger.js')
const geoIpStatus = {
  debug: !!process.env.DEBUG
}

function initIpAddress () {
  publicIp
    .v4()
    .then(ip => {
      consoleLogger.log('GeoIP: Loading Public IP')
      geoIpStatus.ipAddress = ip
    })
    .catch(err => {
      consoleLogger.error('GeoIP: error ' + err)
      geoIpStatus.geoIpFailed = true
    })
}

function geoipOutputFilter (context, config, eventEmitter, data, callback) {
  geoIpStatus.debug = config.debug
  geoIpStatus.field =
    process.env.GEOIP_FIELD || geoIpStatus.field || config.field

  if (geoIpStatus.field) {
    if (geoIpStatus.debug) {
      consoleLogger.log('GeoIP: Lookup enabled for field: ' + geoIpStatus.field)
    }

    if (data[geoIpStatus.field]) {
      data.geo = {
        ip: data[geoIpStatus.field]
      }
    }
    return callback(null, data)
  }

  if (geoIpStatus.geoIpFailed === true) {
    if (geoIpStatus.debug) {
      console.log('GeoIP: Lookup failed for the Public IP address')
    }

    return callback(null, data)
  }

  if (geoIpStatus.debug) {
    console.log(`GeoIP: The Public IP address is ${geoIpStatus.ipAddress}`)
  }
  data.geo = {
    ip: geoIpStatus.ipAddress
  }
  return callback(null, data)
}

initIpAddress()

module.exports = geoipOutputFilter

const publicIp = require('public-ip')
const consoleLogger = require('../../util/logger.js')
const geoIpStatus = {
  ipAddress: '',
  debug: !!process.env.DEBUG
}

function initIpAddress () {
  publicIp.v4().then(ip => {
    consoleLogger.log('GeoIP: Loading Public IP')
    geoIpStatus.ipAddress = ip
  })
}

function geoipOutputFilter (context, config, eventEmitter, data, callback) {
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

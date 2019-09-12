var path = require('path')
var fs = require('fs')
var consoleLogger = require('../../util/logger.js')
var maxmindUpdate = require('../../parser/maxmind-update')
var MaxMindReader = require('maxmind').Reader
var cityLookup = null
var geoIpStatus = {
  maxmindDbDir: process.env.MAXMIND_DB_DIR || '/tmp/',
  fields: process.env.GEOIP_FIELDS,
  debug: !!process.env.DEBUG
}

function enrichGeoIp (parsedObject, fieldName) {
  if (cityLookup != null && parsedObject[fieldName]) {
    var location = cityLookup.get(parsedObject[fieldName])
    if (location && location.country && location.city && location.city.names && location.city.names.en) {
      parsedObject['geoip'] = {
        location: [location.location.longitude, location.location.latitude],
        info: {
          country: location.country.iso_code,
          continent: location.continent.code,
          city: location.city.names.en
        }
      }
      console.log(parsedObject['geoip'])
    }
  } else {
    return null
  }
}

function initMaxmind () {
  var fileName = path.join((process.env.MAXMIND_DB_DIR || geoIpStatus.maxmindDbDir), 'GeoLite2-City.mmdb')
  maxmindUpdate(true, geoIpStatus.maxmindDbDir, function (err, fileName) {
    if (geoIpStatus.debug) {
      consoleLogger.debug('GeoIP: init GeoIP DB ' + fileName)
    }
    if (err) {
      consoleLogger.error('GeoIP: error ' + err)
      geoIpStatus.geoIpFailed = true
      return
    }
    try {
      fs.statSync(fileName)
      cityLookup = new MaxMindReader(fs.readFileSync(fileName), { watchForUpdates: true })
      if (cityLookup) {
        consoleLogger.debug('GeoIP: open ' + fileName)
      } else {
        consoleLogger.log('GeoIP: error ' + err)
      }
      if (geoIpStatus.fields) {
        consoleLogger.log('GeoIP: lookup enabled for fields ' + geoIpStatus.fields)
      } else {
        consoleLogger.log('GeoIP: lookup enabled ')
      }
    } catch (fsStatError) {
      geoIpStatus.geoIpFailed = true
      consoleLogger.error('GeoIP: error ' + fsStatError)
    }
  })
}

function geoIpEnrichment (context, config, eventEmitter, data, callback) {
  // get config values from output-filter config
  if (!geoIpStatus.fields) {
    geoIpStatus.fields = config.fields
    geoIpStatus.debug = config.debug
  }
  if (geoIpStatus.geoIpFailed === true) {
    return callback(null, data)
  }
  var fields = config.fields || []
  for (var i = 0; i < fields.length; i++) {
    if ((data[fields[i]] !== undefined)) {
      enrichGeoIp(data, fields[i])
    }
  }
  return callback(null, data)
}

function test () {
  var cfg = { fields: ['client_ip'], maxmindDbDir: '/tmp/', debug: true }
  setInterval(() => {
    geoIpEnrichment(null, cfg, null, { client_ip: '94.216.99.1' }, console.log)
    geoIpEnrichment(null, cfg, null, { client_ip: '94.216.99.1' }, () => {
    })
    geoIpEnrichment(null, cfg, null, { client_ip: '94.216.99.1' }, () => {
    })
  }, 200)
}

consoleLogger.log('GeoIP: Loading Maxmind DB ')
initMaxmind()

module.exports = geoIpEnrichment

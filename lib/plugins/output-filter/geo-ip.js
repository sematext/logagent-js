var geoip = require('maxmind')
var fs = require('fs')
var maxmindUpdate = require('../../parser/maxmind-update')
var geoipCity = null
var geoIpStatus = {
  maxmindDbDir: process.env.MAXMIND_DB_DIR || '/tmp',
  fields: process.env.GEOIP_FIELDS,
  debug: !!process.env.DEBUG
}
var buffer = []
var consoleLogger = require('../../util/logger.js')

function enrichGeoIp (parsedObject, fieldName) {
  if (geoipCity != null && parsedObject[fieldName]) {
    var location = geoipCity.get(parsedObject[fieldName])

    if (location && location.country && location.city && location.city.names && location.city.names.en) {
      parsedObject['geoip'] = {
        location: [location.location.longitude, location.location.latitude],
        info: {
          country: location.country.iso_code,
          continent: location.continent.code,
          city: location.city.names.en
        }
      }
    }
  } else {
    return null
  }
}

function initGeoIp (err, fileName, callback) {
  if (geoIpStatus.debug) {
    consoleLogger.debug('GeoIP: init GeoIP DB ' + fileName)
  }
  if (err) {
    consoleLogger.error('GeoIP: error ' + err)
    geoIpStatus.geoIPEnabled = false
    return callback(err)
  }
  try {
    fs.statSync(fileName)
    geoip.open(
      fileName,
      { watchForUpdates: true },
      function (err, cityLookup) {
        if (!err && cityLookup) {
          geoipCity = cityLookup
          geoIpStatus.geoIPEnabled = true
          consoleLogger.debug('GeoIP: initialized')
        } else {
          consoleLogger.log('GeoIP: error ' + err)
        }
        return callback(err, cityLookup)
      })
  // geoip.init(fileName, {indexCache: true, checkForUpdates: true})
  } catch (fsStatError) {
    return callback(fsStatError)
    geoIpStatus.geoIPEnabled = false
  }
}

function maxmindUpdateDone (err) {
  if (!err) {
    geoIpStatus.geoIpReady = true
    // depending on timing field inormation is available or not when DB download is finished
    if (geoIpStatus.fields) {
      consoleLogger.log('GeoIP: lookup enabled for fields ' + geoIpStatus.fields)
    } else {
      consoleLogger.log('GeoIP: lookup enabled ')
    }
  } else {
    geoIpStatus.geoIpFailed = false
    consoleLogger.error('Error initializing GeoIP module ' + err)
  }
  // process buffered logs
  for (var j = 0; j < buffer.length; j++) {
    geoIpEnrichment(buffer[j].context,
      buffer[j].config,
      buffer[j].eventEmitter,
      buffer[j].data,
      buffer[j].callback)
  }
  buffer = []
}

function initMaxmind () {
  var fileName = (process.env.MAXMIND_DB_DIR || geoIpStatus.maxmindDbDir) + 'GeoLite2-City.mmdb'
  geoIpStatus.maxmindUpdate = maxmindUpdate(true, geoIpStatus.maxmindDbDir, function (err, filename) {
    initGeoIp(err, filename, maxmindUpdateDone)
  })
}

function geoIpEnrichment (context, config, eventEmitter, data, callback) {
  if (geoIpStatus.geoIpFailed === true) {
    return callback(null, data)
  }
  if (!geoIpStatus.geoIpInit) {
    geoIpStatus.geoIpInit = true
    if (!geoIpStatus.firstLogReceived) {
      geoIpStatus.firstLogReceived = true
      // get config values from output-filter config
      geoIpStatus.fields = config.fields
      geoIpStatus.debug = config.debug
    }
  }
  // buffer logs having relevant fields until GeoIp DB is ready
  if (!geoIpStatus.geoIpReady) {
    var fields = config.fields || []
    var logHasGeoIpField = false
    for (var i = 0; i < fields.length; i++) {
      if (data[fields[i]] !== undefined) {
        if (config.debug === true) {
          consoleLogger.debug('GeoIP: add log to buffer' + (buffer.length + 1))
        }
        logHasGeoIpField = true
      }
    }
    if (logHasGeoIpField) {
      buffer.push({
          context: context,
          config: config,
          eventEmitter: eventEmitter,
          data: data,
          callback: callback
        })
    } else {
      return callback(null, data)
    }
    
  } else {
    var fields = config.fields || []
    // process current log
    for (var i = 0; i < fields.length; i++) {
      if (data[fields[i]] !== undefined) {
        enrichGeoIp(data, fields[i])
      }
    }
    return callback(null, data)
  }
}
consoleLogger.log('GeoIP: initlaize Maxmind DB ')

initMaxmind()

function test () {
  var cfg = { fields: ['client_ip'], maxmindDbDir: '/tmp/', debug: false }
  setInterval(() => {
    geoIpEnrichment(null, cfg, null, {client_ip: '94.216.99.1'}, console.log)
    geoIpEnrichment(null, cfg, null, {client_ip: '94.216.99.1'}, () => {
    })
    geoIpEnrichment(null, cfg, null, {client_ip: '94.216.99.1'}, () => {
    })
  }, 200)
}

if (require.main === module) {
  test()
}

module.exports = geoIpEnrichment

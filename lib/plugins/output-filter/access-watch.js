'use strict'

var request = require('request')

var LRU = require('lru-cache')

var md5 = require('md5')

function init (config, context, eventEmitter) {
  if (config.initialized) {
    return
  }

  if (config.matchTypes === undefined) {
    config.matchTypes = ['access_common', 'access_log_combined']
  }

  if (config.clientIpField === undefined) {
    config.clientIpField = 'client_ip'
  }

  if (config.userAgentField === undefined) {
    config.userAgentField = 'user_agent'
  }

  if (config.maxQueueLength === undefined) {
    config.maxQueueLength = 1000
  }

  if (config.cacheSize === undefined) {
    config.cacheSize = 1000
  }

  if (!config.cache) {
    config.cache = LRU({max: config.cacheSize})
  }

  config.initialized = true
}

var queue = []

var fetching = {}

var queueHandler

function fetchAddressData (config, data, callback) {
  var ip = data[config.clientIpField]
  var ipCacheKey = 'address_' + md5(ip)

  var fromCache = config.cache.get(ipCacheKey)
  if (fromCache) {
    data.address = fromCache
    callback(null, data)
    return
  }

  if (fetching[ip] !== undefined || Object.keys(fetching).length > 10) {

    if (queue.length > config.maxQueueLength) {
      console.log('Skipping augmentation (queue too large, check: config.maxQueueLength)')
      callback(null, data)
      return
    }

    queue.push([config, data, callback])
    if (!queueHandler) {
      queueHandler = setTimeout(handleQueue, 1)
    }

    return
  }

  // Register the process
  fetching[ip] = 1

  var options = {
    url: 'https://api.access.watch/1.1/address/' + ip,
    headers: {
      'User-Agent': 'Access Watch Logagent Plugin',
      'Api-Key':    config.apiKey
    }
  }

  request(options, function (error, response, body) {
    if (error) {
      callback(null, data)
    }
    else {
      if (body) {
        var address = JSON.parse(body)
        if (address) {
          data.address = address
          config.cache.set(ipCacheKey, address)
        }
      }
      callback(null, data)
    }

    // Release
    delete fetching[ip]
  })

}

function handleQueue() {
  while (Object.keys(fetching).length < 10 && queue.length > 0) {
    var args = queue.shift()
    fetchAddressData.apply(null, args)
  }

  queueHandler = setTimeout(handleQueue, 100)
}

function accessWatch (context, config, eventEmitter, data, callback) {
  if (data == null) {
    return callback(new Error('data is null'), null)
  }

  init(config, context, eventEmitter)

  if (config.matchTypes && data._type && config.matchTypes.indexOf(data._type) > -1) {
    if (config.clientIpField && data[config.clientIpField]) {
      fetchAddressData (config, data, callback)
    }
  }
  else {
    callback(null, data)
  }
}

module.exports = accessWatch

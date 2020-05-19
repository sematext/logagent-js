'use strict'

var request = require('request')

var LRU = require('lru-cache')

var md5 = require('md5')

var defaultConfig = {
  matchTypes: ['access_common', 'access_log_combined'],

  addressSource: 'client_ip',
  userAgentSource: 'user_agent',

  identityDestination: null,
  addressDestination: null,
  robotDestination: null,
  reputationDestination: null,

  identityProperties: ['type'],
  addressProperties: ['value', 'hostname', 'country_code', 'flags'],
  robotProperties: ['id', 'name', 'url'],
  reputationProperties: ['status', 'threats'],

  cacheSize: 10000,

  maxQueueLength: 1000,

  requestUserAgent: 'Access Watch Logagent Plugin',

  apiBaseUrl: 'https://api.access.watch'
}

function init (config, context, eventEmitter) {
  if (config.initialized) {
    return
  }

  for (var key in defaultConfig) {
    if (defaultConfig.hasOwnProperty(key)) {
      if (typeof config[key] === 'undefined') {
        config[key] = defaultConfig[key]
      }
    }
  }

  if (!config.apiKey) {
    console.log(
      'Please configure the Access Watch plugin with an apiKey: get one for free from https://access.watch/reveal'
    )
    return
  }

  if (!config.requestHeaders) {
    config.requestHeaders = {
      'User-Agent': config.requestUserAgent,
      'Api-Key': config.apiKey
    }
  }

  if (!config.cache) {
    config.cache = LRU({ max: config.cacheSize })
  }

  config.initialized = true
}

var queueHandler

var queue = []

var currentRequests = {}

function requestData (options, callback) {
  if (options.cache && options.id) {
    var object = options.cache.get(options.id)
    if (object) {
      callback(object)
      return
    }
  }

  if (Object.keys(currentRequests).length >= 10) {
    if (options.queue.length >= options.maxQueueLength) {
      console.log('Skipping request (queue too large, check maxQueueLength)')
      callback(null)
      return
    }

    options.queue.push([options, callback])
    if (!queueHandler) {
      queueHandler = setTimeout(handleQueue, 100)
    }
    return
  }

  var requestIdentifier = Date.now() + Math.random()
  currentRequests[requestIdentifier] = 1

  request(options, function (error, response, body) {
    delete currentRequests[requestIdentifier]
    if (error) {
      return callback(null)
    }
    if (body) {
      var object
      if (typeof body === 'object') {
        object = body
      } else if (typeof body === 'string') {
        object = JSON.parse(body)
      }
      if (object) {
        if (options.cache && options.id) {
          options.cache.set(options.id, object)
        }
        callback(object)
        return
      }
    }
    callback(null)
  })
}

function fetchUserAgentData (userAgent, config, data, callback) {
  var hash = md5(userAgent)

  var options = {
    id: 'user_agent_' + hash,
    url: config.apiBaseUrl + '/1.1/user-agent/' + hash,
    headers: config.requestHeaders,
    cache: config.cache,
    queue: queue,
    maxQueueLength: config.maxQueueLength
  }

  requestData(options, function (result) {
    if (result && config.hasOwnProperty('userAgentDestination')) {
      data = augmentData(data, result, config.userAgentDestination)
    }
    callback(null, data)
  })
}

function fetchAddressData (address, config, data, callback) {
  var hash = md5(address)

  var options = {
    id: 'address_' + hash,
    url: config.apiBaseUrl + '/1.1/address/' + hash,
    headers: config.requestHeaders,
    cache: config.cache,
    queue: queue,
    maxQueueLength: config.maxQueueLength
  }

  requestData(options, function (result) {
    if (result && config.hasOwnProperty('addressDestination')) {
      data = augmentData(
        data,
        result,
        config.addressDestination,
        config.addressProperties
      )
    }
    callback(null, data)
  })
}

function fetchIdentityData (address, userAgent, config, data, callback) {
  var options = {
    method: 'POST',
    json: { address: address, user_agent: userAgent },
    id: 'identity_' + md5(address) + '_' + md5(userAgent),
    url: config.apiBaseUrl + '/1_1/identity',
    headers: config.requestHeaders,
    cache: config.cache,
    queue: queue,
    maxQueueLength: config.maxQueueLength
  }

  requestData(options, function (result) {
    if (result) {
      if (config.hasOwnProperty('identityDestination')) {
        data = augmentData(
          data,
          result,
          config.identityDestination,
          config.identityProperties
        )
      }
      if (
        result.hasOwnProperty('address') &&
        config.hasOwnProperty('addressDestination')
      ) {
        data = augmentData(
          data,
          result.address,
          config.addressDestination,
          config.addressProperties
        )
      }
      if (
        result.hasOwnProperty('robot') &&
        config.hasOwnProperty('robotDestination')
      ) {
        data = augmentData(
          data,
          result.robot,
          config.robotDestination,
          config.robotProperties
        )
      }
      if (
        result.hasOwnProperty('reputation') &&
        config.hasOwnProperty('reputationDestination')
      ) {
        data = augmentData(
          data,
          result.reputation,
          config.reputationDestination,
          config.reputationProperties
        )
      }
    }
    callback(null, data)
  })
}

function augmentData (data, object, destination, properties) {
  if (!destination || !properties) {
    return data
  }

  if (properties) {
    data[destination] = {}
    properties.forEach(function (key) {
      if (object.hasOwnProperty(key)) {
        data[destination][key] = object[key]
      }
    })
  } else {
    data[destination] = object
  }

  return data
}

function handleQueue () {
  while (Object.keys(currentRequests).length < 10 && queue.length > 0) {
    var args = queue.shift()
    requestData.apply(null, args)
  }

  queueHandler = setTimeout(handleQueue, 100)
}

function accessWatch (context, config, eventEmitter, data, callback) {
  if (data == null) {
    return callback(new Error('data is null'), null)
  }

  init(config, context, eventEmitter)

  if (!config.initialized) {
    return
  }

  if (
    config.matchTypes &&
    data._type &&
    config.matchTypes.indexOf(data._type) > -1
  ) {
    var address, userAgent
    if (config.addressSource && data[config.addressSource]) {
      address = data[config.addressSource]
    }
    if (config.userAgentSource && data[config.userAgentSource]) {
      userAgent = data[config.userAgentSource]
      if (userAgent === '-') {
        userAgent = null
      }
    }
    if (address && userAgent) {
      fetchIdentityData(address, userAgent, config, data, callback)
    } else if (address) {
      fetchAddressData(address, config, data, callback)
    } else if (userAgent) {
      fetchUserAgentData(userAgent, config, data, callback)
    } else {
      callback(null, data)
    }
  } else {
    callback(null, data)
  }
}

module.exports = accessWatch

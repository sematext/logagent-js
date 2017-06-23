'use strict'

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

  config.initialized = true
}

function accessWatch (context, config, eventEmitter, data, callback) {
  if (data == null) {
    return callback(new Error('data is null'), null)
  }

  init(config, context, eventEmitter)

  if (config.matchTypes && data._type && config.matchTypes.indexOf(data._type) > -1) {
    // console.log('accept', data)
    callback(null, data)
  }
  else {
    // console.log('reject', data)
    callback(null, data)
  }
}

module.exports = accessWatch

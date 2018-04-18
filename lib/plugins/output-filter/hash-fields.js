var crypto = require('crypto')
var set = require('set-value')
var get = require('get-value')

function replaceAll (target, search, replacement) {
  if (!search) {
    return target
  }
  if (!replacement) {
    return target
  }
  return target.split(search).join(replacement)
}

function hash (input, hashFunction) {
  if (!input) {
    return
  }
  var sha256 = crypto.createHash(hashFunction || 'sha256')
  sha256.update(input.toString())
  return sha256.digest('hex')
}

function hashFields (context, config, eventEmitter, data, callback) {
  if (data === undefined) {
    return callback(new Error('data is null'), null)
  }
  try {
    if (config.matchSource.test(context.sourceName || data.logSource)) {
      if (config.fields && config.fields instanceof Array) {
        for (var i = 0; i < config.fields.length; i++) {
          var fieldValue = get(data, config.fields[i])
          if (fieldValue !== undefined) {
            var newValue = hash(fieldValue, config.algorithm)
            if (data.message && typeof data.message === 'string') {
              data.message = replaceAll(data.message, fieldValue, newValue)
            }
            set(data, config.fields[i], newValue)
          }
        }
      }
    }
  } catch (ex) {
    callback(ex, null)
  }
  callback(null, data)
}

module.exports = hashFields

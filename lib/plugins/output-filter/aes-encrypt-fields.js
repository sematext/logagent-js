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

function aesEncrypt (text, key, aesAlgo) {
  var cipher = crypto.createCipher(aesAlgo || 'aes256', key)
  var crypted = cipher.update(text, 'utf8', 'hex')
  crypted += cipher.final('hex')
  return crypted
}

function aesEncryptFields (context, config, eventEmitter, data, callback) {
  if (data === undefined) {
    return callback(new Error('data is null'), null)
  }
  try {
    if (config.matchSource.test(context.sourceName || data.logSource)) {
      if (config.fields && config.fields instanceof Array) {
        for (var i = 0; i < config.fields.length; i++) {
          var fieldValue = get(data, config.fields[i])
          if (fieldValue !== undefined) {
            var newValue
            if (config.password) {
              newValue = aesEncrypt(
                fieldValue,
                config.password,
                config.algorithm
              )
            }
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
module.exports = aesEncryptFields

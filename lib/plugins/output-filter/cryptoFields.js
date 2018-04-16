var crypto = require('crypto')

function aesEncrypt (text, key) {
  var cipher = crypto.createCipher('aes256', key)
  var crypted = cipher.update(text, 'utf8', 'hex')
  crypted += cipher.final('hex')
  return crypted
}

function aesDecrypt (text, key) {
  var decipher = crypto.createDecipher('aes256', key)
  var dec = decipher.update(text, 'hex', 'utf8')
  dec += decipher.final('utf8')
  return dec
}

function hash (input, hashFunction) {
  var sha256 = crypto.createHash(hashFunction || 'sha256')
  sha256.update(input.toString())
  return sha256.digest('hex')
}

function cryptoFilter (context, config, eventEmitter, data, callback) {
  if (data == null) {
    return callback(new Error('data is null'), null)
  }
  if (config.matchSource.test(context.sourceName)) {
    if (config.fields) {
      for (var i = 0; i < config.fields.length; i++) {
        if (!config.aesPassword) {
          // default hash fields
          data[config.fields[i]] = hash(data[config.fields[i]], config.hashFunction)
        } else {
          if (config.aesDecrypt === true) {
            data[config.fields[i]] = aesDecrypt(data[config.fields[i]], config.aesPassword)
          } else {
            data[config.fields[i]] = aesEncrypt(data[config.fields[i]], config.aesPassword)
          }
        }
      }
    }
    callback(null, data)
  } else {
    // pass data of other log sources, to be handled by other filters
    callback(null, data)
  }
}
module.exports = cryptoFilter

/**

# Example config
ouptput-filter:
  module: anonymizer
  # aesDecrypt: false
  #aesAlgo: aes256
  #aesPassword: "I don't tell you my passw0rd!"
  #aesDecrypt: false
  hashAlgo: sha256
  #truncateIpV4: true
  #truncateIpV6: true
  fields:
    - client_ip
    - server_ip
**/

var crypto = require('crypto')

function replaceAll (target, search, replacement) {
  return target.split(search).join(replacement)
}

function aesEncrypt (text, key, aesAlgo) {
  var cipher = crypto.createCipher(aesAlgo || 'aes256', key)
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

function truncateIpV4 (ip, blocksToKeep) {
  if (!ip) {
    return
  }
  var blocks = ip.split('.')
  var length = blocks.length // should be 4 for valid IPv4 adresses
  blocks = blocks.splice(0, blocksToKeep)
  for (var i = 0; i < (length - blocksToKeep); i++) {
    blocks.push('0')
  }
  return blocks.join('.')
}

function truncateIpV6 (ip) {
  if (!ip) {
    return ip
  }
  var blocks = ip.split(':')
  var length = blocks.length
  var splitted = blocks[length - 1].split('/')
  splitted[0] = '0'
  blocks[blocks.length - 1] = splitted.join('/')
  return blocks.join(':')
}

function hash (input, hashFunction) {
  if (!input) {
    return
  }
  var sha256 = crypto.createHash(hashFunction || 'sha256')
  sha256.update(input.toString())
  return sha256.digest('hex')
}

function anonymizer (context, config, eventEmitter, data, callback) {
  if (data === undefined) {
    return callback(new Error('data is null'), null)
  }
  try {
    if (config.matchSource.test(context.sourceName || data.logSource)) {
      if (config.fields && config.fields instanceof Array) {
        for (var i = 0; i < config.fields.length; i++) {
          if (data[config.fields[i]] !== undefined) {
            var newValue = null
            if (config.truncateIpV6 === true && data[config.fields[i]].indexOf(':') > -1) {
              newValue = truncateIpV6(data[config.fields[i]])
            }
            if (config.truncateIpV4 === true && data[config.fields[i]].indexOf('.') > -1) {
              newValue = truncateIpV4(data[config.fields[i]], 3)
            }
            if (config.hashAlgo) {
              // default hash fields
              newValue = hash(data[config.fields[i]], config.hashAlgo)
            }
            if (config.aesDecrypt === true) {
              newValue = aesDecrypt(data[config.fields[i]], config.aesPassword, config.aesAlgo)
            }
            if (config.aesPassword) {
              newValue = aesEncrypt(data[config.fields[i]], config.aesPassword, config.aesAlgo)
            }
            if (data.message & typeof data.message === 'string') {
              replaceAll(data.message, data[config.fields[i]], newValue)
            }
            data[config.fields[i]] = newValue
          }
        }
      }
    }
  } catch (ex) {
    callback(ex, null)
  }

  callback(null, data)
}
module.exports = anonymizer

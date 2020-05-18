/**

outputFilter:
  ip-truncate-fields:
    module: ip-truncate-fields
    # JS regeular expression to match log source name
    matchSource: !!js/regexp nginx
    # not existing fields are ignored
    # existing field values are replaced according to config below
    fields:
      - client_ip
      - x.y
*/

var set = require('set-value')
var get = require('get-value')

function replaceAll (target, search, replacement) {
  if (!target) {
    return target
  }
  if (!search) {
    return target
  }
  if (!replacement) {
    return target
  }
  return target.split(search).join(replacement)
}

function truncateIpV4 (ip, blocksToKeep) {
  if (!ip) {
    return
  }
  var blocks = ip.split('.')
  var length = blocks.length // should be 4 for valid IPv4 adresses
  blocks = blocks.splice(0, blocksToKeep)
  for (var i = 0; i < length - blocksToKeep; i++) {
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

function ipTuncateFields (context, config, eventEmitter, data, callback) {
  if (data === undefined) {
    return callback(new Error('data is null'), null)
  }
  try {
    if (config.matchSource.test(context.sourceName || data.logSource)) {
      if (config.fields && config.fields instanceof Array) {
        for (var i = 0; i < config.fields.length; i++) {
          if (data[config.fields[i]] !== undefined) {
            var newValue = null
            var fieldValue = String(get(data, config.fields[i]) || '')
            if (fieldValue.indexOf(':') > -1) {
              newValue = truncateIpV6(data[config.fields[i]])
            }
            if (fieldValue.indexOf('.') > -1) {
              newValue = truncateIpV4(fieldValue, 3)
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
    console.log(ex)
    callback(null, data)
  }

  callback(null, data)
}
module.exports = ipTuncateFields

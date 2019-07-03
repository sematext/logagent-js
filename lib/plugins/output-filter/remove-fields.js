var get = require('get-value')
var unset = require('unset-value')

function replaceAll (target, search, replacement) {
  if (!search) {
    return target
  }
  if (!replacement) {
    return target
  }
  return target.split(search).join(replacement)
}

function removeFields (context, config, eventEmitter, data, callback) {
  if (data === undefined) {
    return callback(new Error('data is null'), null)
  }
  try {
    if (config.matchSource.test(context.sourceName || data.logSource)) {
      if (config.fields && config.fields instanceof Array) {
        for (var i = 0; i < config.fields.length; i++) {
          var fieldValue = get(data, config.fields[i])
          unset(data, config.fields[i])
          if (config.maskValuesInMessageField === true && data.message & typeof data.message === 'string') {
            data.message = replaceAll(data.message, fieldValue, config.replace || '!REMOVED!')
          }
        }
      }
    }
  } catch (ex) {
    callback(ex, null)
  }
  callback(null, data)
}
module.exports = removeFields

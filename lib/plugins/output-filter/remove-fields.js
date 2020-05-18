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
          if (config.maskValuesInFields) {
            for (var j = 0; j < config.maskValuesInFields.length; j++) {
              var value = data[config.maskValuesInFields[j]]
              if (value && typeof value === 'string') {
                data[config.maskValuesInFields[j]] = replaceAll(
                  data[config.maskValuesInFields[j]],
                  fieldValue,
                  config.maskValuesString || '!REMOVED!'
                )
              }
            }
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

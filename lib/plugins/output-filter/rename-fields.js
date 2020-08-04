const get = require('get-value')
const unset = require('unset-value')
const set = require('set-value')

function renameFields (context, config, eventEmitter, data, callback) {
  if (data === undefined) {
    return callback(new Error('data is null'), null)
  }
  try {
    if (!config.matchSource.test(context.sourceName || data.logSource)) {
      return callback(null, data)
    }

    const fields = config.fields
    fields.forEach(field => {
      const { fieldName, renameTo } = field
      const fieldValue = get(data, fieldName)
      unset(data, fieldName)
      set(data, renameTo, fieldValue)
    })

    callback(null, data)
  } catch (ex) {
    callback(ex, null)
  }
}
module.exports = renameFields

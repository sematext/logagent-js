const get = require('get-value')
const unset = require('unset-value')
const set = require('set-value')

function renameFields (context, config, eventEmitter, data, callback) {
  if (data === undefined) {
    return callback(new Error('data is null'), null)
  }
  if (config.allFields !== true) {
    config.allFields = false
  }

  try {
    if (!config.matchSource.test(context.sourceName || data.logSource)) {
      return callback(null, data)
    }

    if (config.allFields === true) {
      const fields = Object.keys(data)
      fields.forEach(field => {
        const lowerCaseField = field.toLowerCase()
        const fieldValue = get(data, field)
        unset(data, field)
        set(data, lowerCaseField, fieldValue)
      })
      return callback(null, data)
    }

    const fields = config.fields
    fields.forEach(field => {
      const { fieldName } = field
      const lowerCaseField = fieldName.toLowerCase()
      const fieldValue = get(data, fieldName)
      unset(data, fieldName)
      set(data, lowerCaseField, fieldValue)
    })

    callback(null, data)
  } catch (ex) {
    callback(ex, null)
  }
}
module.exports = renameFields

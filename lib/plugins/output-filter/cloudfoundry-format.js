function jsonParse (text) {
  try {
    return JSON.parse(text)
  } catch (err) {
    return null
  }
}

function extractJson (line, source) {
  var parsed = {}
  if (/^\[{0,1}\{.*\}]{0,1}$/.test(line)) {
    parsed = jsonParse(line)
    if (!parsed) {
      return null
    }
    return parsed
  }
}

function filterCloudFoundryMessage (data, context) {
  if (data) {
    data._type = context.sourceName.replace('_' + context.index, '')
    data.logSource = ('' + data.logSource).replace('_' + context.index, '')
    if (!data['@timestamp']) {
      data['@timestamp'] = new Date()
    }
    if (data.message) {
      data.json = extractJson(data.message)
    }
  }
  return data
}

function parseCloudFoundryTags (tags) {
  try {
    const parsedTags2dArr = tags
      .split(' ')
      .map(t => t.replace(/"/g, '').split('='))

    const parsedTags = parsedTags2dArr
      .map(a => {
        const obj = {}
        obj[a[0]] = a[1]
        return obj
      })
      .reduce((acc, o) => {
        const key = Object.keys(o).pop()
        acc[key] = o[key]

        return acc
      }, {})

    return parsedTags
  } catch (error) {
    console.error(error)
    return tags
  }
}

module.exports = function (context, config, eventEmitter, log, callback) {
  try {
    const filteredLog = filterCloudFoundryMessage(log, context)
    const json = filteredLog.json
    const message = filteredLog.message
    delete filteredLog.json
    delete filteredLog.message
    const tags = parseCloudFoundryTags(filteredLog.tags)
    delete filteredLog.tags

    const parsedLog = {
      message,
      ...json,
      ...filteredLog,
      ...tags
    }

    return callback(null, parsedLog)
  } catch (err) {
    console.log(err)
    return callback(null, log)
  }
}

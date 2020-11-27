function parseHerokuMessage (data, context) {
  if (data) {
    const json = data.json
    const message = data.message
    delete data.json
    delete data.message
    return {
      message,
      ...json,
      ...data
    }
  }
  return data
}

module.exports = function (context, config, eventEmitter, log, callback) {
  try {
    const parsedLog = parseHerokuMessage(log, context)

    return callback(null, parsedLog)
  } catch (err) {
    console.error(err)
    return callback(null, log)
  }
}

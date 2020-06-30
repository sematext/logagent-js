module.exports = function (context, config, eventEmitter, log, callback) {
  try {
    const jsonMessage = JSON.parse(log.message)
    delete log.message
    const parsedLog = {
      ...jsonMessage,
      ...log
    }

    console.log('\n\n\n\n\n\n\n')
    console.log('in cf filter')
    console.log(parsedLog)
    console.log('\n\n\n\n\n\n\n')

    return callback(null, parsedLog)
  } catch (err) {
    return callback(null, log)
  }
}

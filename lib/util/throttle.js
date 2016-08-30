var StreamThrottle = require('stream-throttle').Throttle
var maxInputRate = 1024 * 1024 * 100

function Throttle (maxRate) {
  var inputRate = maxRate || maxInputRate
  var chunkSize = inputRate / 10
  if (chunkSize < 1) {
    chunkSize = 1
  }
  return new StreamThrottle({
    chunksize: chunkSize,
    rate: inputRate || maxInputRate
  })
}
module.exports = Throttle

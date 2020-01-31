'use strict'
/**
 * Parse a list of URLs to an array with base URL and index for elasticsearch API endpoints
 * Return value is an array with objects with url and index property, e.g.
 *   [{url: 'http://servername', index: 'logs'}]
 * @receiverListAsString a comma separatedlist of URLs
 */
function parseReceiverList (receiverListAsString) {
  if (!receiverListAsString) {
    return undefined
  }
  let receivers = []
  let parseUrlRegx = /(\S+:\/\/\S+?)\/(\S+)$/i
  let receiverList = receiverListAsString.split(',')
  for (let receiver of receiverList) {
    let url = receiver.match(parseUrlRegx)
    if (url && url.length === 3) {
      receivers.push({
        url: url[1],
        index: url[2]
      })
    }
  }
  return receivers
}

/**
 * Parse Docker image names.
 * Returns an object with name,registry, tag properties.
 *   [{url: 'http://servername', index: 'logs'}]
 * @receiverListAsString a comma separatedlist of URLs
 */
var parseImageRegex = /^(\S+?\.\S+?\/|\S+?\:\d+\/){0,1}(\S+?):(\S+?){0,1}(@\S+?){0,1}$/i
function parseImage (image) {
  var rv = { name: image }
  var result = parseImageRegex.exec(image)
  if (result) {
    if (result.length > 3) {
      if (result[1]) {
        rv.registry = result[1]
      }
      rv.name = result[2]
      rv.tag = result[3]
      if (result[4] !== undefined) {
        rv.digest = result[4].substring(1, result[4].length)
      }
    }
  }
  return rv
}

module.exports = {
  parseImage: parseImage,
  parseReceiverList: parseReceiverList
}

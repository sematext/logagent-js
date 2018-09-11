'use strict'

function reduce (context, data, conf) {
  let newConf = {}
  for (var key in conf) {
    if (key === 'tokenMapper') {
      newConf[key] = conf[key]
      continue
    }
    if (!conf.hasOwnProperty(key)) {
      continue
    }
    if (typeof conf[key] !== 'function') {
      newConf[key] = conf[key]
      continue
    }
    newConf[key] = conf[key](context, conf, data)
  }
  return newConf
}

module.exports = reduce

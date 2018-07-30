'use strict'

function serialize(context, data, conf) {
    let newConf = {}
    for (var key in conf) {
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

module.exports = serialize

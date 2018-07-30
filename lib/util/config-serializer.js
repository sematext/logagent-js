'use strict'

function serialize(conf, context, data) {
    let newConf = {}
    for (var key in conf) {
        if (!conf.hasOwnProperty(key)) {
            continue
        }
        if (typeof conf[key] !== 'function') {
            newConf[key] = conf[key]
            continue
        }
        newConf[key] = conf[key](context,data)
    }
    return newConf
}

module.exports = serialize

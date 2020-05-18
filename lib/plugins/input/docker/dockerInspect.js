#!/usr/bin/env node
var Docker = require('dockerode')
var docker = new Docker()
var minimatch = require('minimatch')
var consoleLogger = require('../../../util/logger.js')
var parser = require('../../../util/parser.js')

var dockerInfo = {}
var tagIds = null

const TRUE_REGEX = /true/i
// The run.sh sets both LOGSENE_ENABLED_DEFAULT and LOGS_ENABLED_DEFAULT to TRUE by default.
// Users should set either of these two to FALSE to disable logging by default for all containers.
// This means you need to use whitelisting to enable logging for certain containers.
// In the ENV for those containers set 'LOGS_ENABLED=true' or 'LOGSENE_ENABLED=true'.
// const LOGS_ENABLED_DEFAULT = TRUE_REGEX.test((process.env.LOGSENE_ENABLED_DEFAULT && process.env.LOGS_ENABLED_DEFAULT) || 'true')
const LOGSENE_ENABLED_DEFAULT = TRUE_REGEX.test(
  process.env.LOGSENE_ENABLED_DEFAULT
)
const LOGS_ENABLED_DEFAULT = TRUE_REGEX.test(process.env.LOGS_ENABLED_DEFAULT)
const FINAL_LOGS_ENABLED_DEFAULT =
  LOGSENE_ENABLED_DEFAULT && LOGS_ENABLED_DEFAULT

docker.info(function dockerInfoHandler (err, data) {
  if (err) {
    console.error(err)
  }
  if (data) {
    // set Docker Hostname for logsene-js
    if (data.Name && process.env.SPM_REPORTED_HOSTNAME === undefined) {
      process.env.SPM_REPORTED_HOSTNAME = data.Name
    }
    dockerInfo = data
    // SPM_MONITOR_TAGS is evaluated by spm-sender before it sends metrics to SPM
    if (!process.env.SPM_MONITOR_TAGS) {
      if (data.Labels && data.Labels.length > 0) {
        process.env.SPM_MONITOR_TAGS = data.Labels.join(',')
      }
    } else {
      if (data.Labels && data.Labels.length > 0) {
        process.env.SPM_MONITOR_TAGS =
          process.env.SPM_MONITOR_TAGS + ',' + data.Labels.join(',')
      }
    }
  }
})

function getEnvVar (name, list) {
  if (!list) {
    return null
  }
  if (!(list instanceof Array)) {
    var keys = Object.keys(list)
    for (var k = 0; k < keys.length; k++) {
      if (keys[k] === name) {
        return list[keys[k]].trim()
      }
    }
  } else {
    for (var i = 0; i < list.length; i++) {
      if (list[i].indexOf(name) > -1) {
        var rv = list[i].split('=')
        if (rv && rv.length > 1 && rv[0] === name) {
          return rv[1]
        }
      }
    }
  }
  return null
}

function getValue (name, list, info) {
  if (!list) {
    return null
  }
  if (!(list instanceof Array)) {
    var keys = Object.keys(list)
    for (var k = 0; k < keys.length; k++) {
      if (minimatch(keys[k], name)) {
        if (!info.tags) {
          info.tags = {}
        }
        info.tags[keys[k]] = list[keys[k]]
      }
    }
  } else {
    for (var i = 0; i < list.length; i++) {
      if (minimatch(list[i], name)) {
        var value = list[i].split('=')
        if (value.length > 1) {
          if (!info.tags) {
            info.tags = {}
          }
          info.tags[value[0]] = value[1]
        }
      }
    }
  }

  return null
}

function extractLoggingTags (labels, env, info) {
  if (tagIds === null) {
    if (process.env.TAGGING_LABELS) {
      tagIds = process.env.TAGGING_LABELS.split(',')
    } else {
      tagIds = ['com.docker.*', 'io.kubernetes.*', 'annotation.io.*']
    }
  }
  if (tagIds.length > 0) {
    for (var i = 0; i < tagIds.length; i++) {
      getValue(tagIds[i] + '*', labels, info)
      getValue(tagIds[i] + '*', env, info)
      getValue(tagIds[i] + '*', dockerInfo.Labels, info)
    }
  }
}

function getLogseneEnabled (info) {
  let token = null

  extractLoggingTags(info.Config.Labels, info.Config.Env, info)

  // tag container info with LOGSENE_ENABLED flag
  // check for Labels
  if (info.Config && info.Config.Labels) {
    info.LOGSENE_ENABLED =
      info.Config.Labels.LOGSENE_ENABLED ||
      info.Config.Labels.LOGS_ENABLED ||
      null
  }

  if (info.LOGSENE_ENABLED === null) {
    // console.log('Container ' + info.Id + ' ' + info.Name + ' setting LOGS_ENABLED not specified')
    // set the desired default from Logagent config environment

    // no Label set, check for ENV var
    const LOGSENE_ENABLED = getEnvVar('LOGSENE_ENABLED', info.Config.Env)
    const LOGS_ENABLED = getEnvVar('LOGS_ENABLED', info.Config.Env)

    if (LOGSENE_ENABLED !== null) {
      info.LOGSENE_ENABLED = LOGSENE_ENABLED
    }
    if (LOGS_ENABLED !== null) {
      info.LOGSENE_ENABLED = LOGS_ENABLED
    }

    if (info.LOGSENE_ENABLED === null) {
      info.LOGSENE_ENABLED = FINAL_LOGS_ENABLED_DEFAULT
    }
  }

  if (
    info.LOGSENE_ENABLED === '0' ||
    info.LOGSENE_ENABLED === 'false' ||
    info.LOGSENE_ENABLED === 'no' ||
    info.LOGSENE_ENABLED === false
  ) {
    consoleLogger.log(
      'Container ' +
        info.Id +
        ' ' +
        info.Name +
        ' setting LOGSENE_ENABLED=false'
    )
    info.LOGSENE_ENABLED = false
  } else {
    info.LOGSENE_ENABLED = true
    consoleLogger.log(
      'Container ' + info.Id + ' ' + info.Name + ' setting LOGSENE_ENABLED=true'
    )
  }

  if (info.Config && info.Config.Labels && info.Config.Labels.LOGSENE_TOKEN) {
    token = info.Config.Labels.LOGSENE_TOKEN
    info.LOGSENE_TOKEN = token
  } else {
    token = getEnvVar('LOGSENE_TOKEN', info.Config.Env)
  }
  if (!token) {
    if (info.Config && info.Config.Labels && info.Config.Labels.LOGS_TOKEN) {
      token = info.Config.Labels.LOGS_TOKEN
      info.LOGSENE_TOKEN = token
    } else {
      token = getEnvVar('LOGS_TOKEN', info.Config.Env)
    }
  }
  info.LOGSENE_TOKEN =
    token || process.env.LOGS_TOKEN || process.env.LOGSENE_TOKEN

  // get optional log receiver URLs
  let logsReceivers = null
  if (
    info.Config &&
    info.Config.Labels &&
    info.Config.Labels.LOGS_RECEIVER_URLS
  ) {
    logsReceivers = info.Config.Labels.LOGS_RECEIVER_URLS
  } else {
    logsReceivers = getEnvVar('LOGS_RECEIVER_URLS', info.Config.Env)
  }
  if (logsReceivers) {
    info.LOGS_RECEIVER_URLS = parser.parseReceiverList(logsReceivers)
  }

  // get optional log receiver
  if (
    info.Config &&
    info.Config.Labels &&
    info.Config.Labels.LOGS_RECEIVER_URL
  ) {
    info.LOGS_RECEIVER_URL = info.Config.Labels.LOGS_RECEIVER_URL
  } else {
    info.LOGS_RECEIVER_URL = getEnvVar('LOGS_RECEIVER_URL', info.Config.Env)
  }

  // get optional logs target name
  if (
    info.Config &&
    info.Config.Labels &&
    info.Config.Labels.LOGS_DESTINATION
  ) {
    info.LOGS_DESTINATION = info.Config.Labels.LOGS_DESTINATION
  } else {
    info.LOGS_DESTINATION = getEnvVar('LOGS_DESTINATION', info.Config.Env)
  }

  return info
}

function getLogseneToken (err, info) {
  let token = null
  if (!err) {
    extractLoggingTags(info.Config.Labels, info.Config.Env, info)
    // tag container info with LOGSENE_ENABLED flag
    // check for Labels
    if (
      info.Config &&
      info.Config.Labels &&
      info.Config.Labels.LOGSENE_ENABLED !== undefined
    ) {
      info.LOGSENE_ENABLED = info.Config.Labels.LOGSENE_ENABLED
    } else {
      // no Label set, check for ENV var
      info.LOGSENE_ENABLED = getEnvVar('LOGSENE_ENABLED', info.Config.Env)
    }
    if (info.LOGSENE_ENABLED === null) {
      // no Label or env var set, use LOGS_ENABLED_DEFAULT
      // console.log('Container ' + info.Id + ' ' + info.Name + ' setting LOGSENE_ENABLED not specified')
      // set the desired default from Logagent config environment
      info.LOGSENE_ENABLED = FINAL_LOGS_ENABLED_DEFAULT
    }

    if (
      info.LOGSENE_ENABLED === '0' ||
      info.LOGSENE_ENABLED === 'false' ||
      info.LOGSENE_ENABLED === 'no'
    ) {
      consoleLogger.log(
        'Container ' +
          info.Id +
          ' ' +
          info.Name +
          ' setting LOGSENE_ENABLED=false'
      )
      info.LOGSENE_ENABLED = false
    } else {
      info.LOGSENE_ENABLED = true
      consoleLogger.log(
        'Container ' +
          info.Id +
          ' ' +
          info.Name +
          ' setting LOGSENE_ENABLED=true'
      )
    }
    if (info.Config && info.Config.Labels && info.Config.Labels.LOGSENE_TOKEN) {
      token = info.Config.Labels.LOGSENE_TOKEN
      info.LOGSENE_TOKEN = token
    } else {
      token = getEnvVar('LOGSENE_TOKEN', info.Config.Env)
    }
  }
  if (info) {
    info.LOGSENE_TOKEN = token || process.env.LOGSENE_TOKEN
    info.dockerInfo = dockerInfo
    this.callback(null, info)
  } else {
    this.callback(null, {
      LOGSENE_TOKEN: process.env.LOGSENE_TOKEN,
      id: this.container
    })
  }
}

function getLogseneTokenForContainer (id, cb) {
  docker.getContainer(id).inspect(
    getLogseneToken.bind({
      callback: cb,
      container: id
    })
  )
}

module.exports = {
  getLogseneTokenForContainer: getLogseneTokenForContainer,
  getLogseneEnabled: getLogseneEnabled
}

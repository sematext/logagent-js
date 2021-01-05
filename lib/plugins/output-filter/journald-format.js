// Transforming journald fields to Sematext Common Schema https://sematext.com/docs/tags/common-schema/
// see https://sematext.com/docs/agents/sematext-agent/processes/metadata/
const Parser = require('../../parser/parser.js')
const logParser = new Parser()

// journald fields for lowercase access
const __REALTIME_TIMESTAMP = '__realtime_timestamp'
const __SOURCE_REALTIME_TIMESTAMP = '_source_realtime_timestamp'
const _HOSTNAME = '_hostname'
const _SYSTEMD_UNIT = '_systemd_unit'
const PRIORITY = 'priority'
const SYSLOG_FACILITY = 'syslog_facility'
const CONTAINER_TAG = 'container_tag'
const CONTAINER_ID_FULL = 'container_id_full'
const CONTAINER_ID = 'container_id'
const CONTAINER_NAME = 'container_name'

// field mapping for Sematext Common Schema
const processFields = {
  _pid: 'pid',
  _uid: 'uid',
  _gid: 'gid',
  _cmdline: 'cmd',
  _systemd_cgroup: 'cgroup'
}
// mapping for syslog priority and facility values
const SEVERITY = [
  'emerg',
  'alert',
  'crit',
  'err',
  'warning',
  'notice',
  'info',
  'debug'
]

const FACILITY = [
  'kern',
  'user',
  'mail',
  'daemon',
  'auth',
  'syslog',
  'lpr',
  'news',
  'uucp',
  'cron',
  'authpriv',
  'ftp',
  'ntp',
  'logaudit',
  'logalert',
  'clock',
  'local0',
  'local1',
  'local2',
  'local3',
  'local4',
  'local5',
  'local6',
  'local7'
]

function applySematextCommonSchema (
  context,
  config,
  eventEmitter,
  log,
  callback
) {
  try {
    if (!config.matchSource.test(context.sourceName || log.logSource)) {
      return callback(null, log)
    }

    // use Sematext common schema os.host = hostname
    const hostname = log[_HOSTNAME]
    if (hostname) {
      log.os = { host: hostname }
      delete log[_HOSTNAME]
    }
    const timestamp =
      log[__REALTIME_TIMESTAMP] || log[__SOURCE_REALTIME_TIMESTAMP]
    if (timestamp) {
      var d = new Date(Number(timestamp) / 1000)
      if (d instanceof Date && !isNaN(d)) {
        log['@timestamp'] = d
      }
    }
    const prio = log[PRIORITY]
    const facility = log[SYSLOG_FACILITY]
    // handling syslog priorit and facility values
    if (prio || facility) {
      log.facility = FACILITY[facility]
      log.severity = SEVERITY[prio]
    }
    // handling docker journald-drive fields
    if (log[CONTAINER_ID_FULL] || log[CONTAINER_NAME]) {
      log.container = {
        id: log[CONTAINER_ID_FULL] || log[CONTAINER_ID],
        name: log[CONTAINER_NAME],
        tag: log[CONTAINER_TAG]
      }
      delete log[CONTAINER_NAME]
      delete log[CONTAINER_TAG]
      delete log[CONTAINER_ID_FULL]
    }
    if (log._pid) {
      log.process = {}
      for (const field in processFields) {
        if (log[field]) {
          log.process[processFields[field]] = log[field]
          delete log[field]
        }
      }
    }
    // optional parsing of message field with logagent patterns
    if (config.parseMessageField === true && log.message !== undefined) {
      let source = log[_SYSTEMD_UNIT]
      if (log.container) {
        source = log.container.tag || log.container.name
      }

      logParser.parseLine(log.message, source, function (err, data) {
        if (err) {
          return callback(null, log)
        }

        if (data && data._type) {
          const type = `${data._type}`
          delete data['@timestamp']
          delete data.logSource
          delete data._type
          log[type] = {}
          Object.assign(log[type], data)
        }
        callback(null, log)
      })
    } else {
      callback(null, log)
    }
  } catch (ex) {
    callback(ex, log)
  }
}

module.exports = applySematextCommonSchema

'use strict'
var consoleLogger = require('../lib/logger.js')
var Syslogd = require('syslogd')

module.exports=function (appToken, port, type, parseLine, log) {
  var SEVERITY = [
    'emerg',
    'alert',
    'crit',
    'err',
    'warning',
    'notice',
    'info',
    'debug'
  ]
  var FACILITY = [
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
  
  var syslogd = Syslogd(function (sysLogMsg) {
    parseLine(sysLogMsg.msg, sysLogMsg.tag, function (e, data) {
      data['severity'] = SEVERITY[sysLogMsg.facility]
      data['syslog-tag'] = sysLogMsg.tag
      if (/\#(.+)\#(.+)\#(.+?)\[(\d+)\]/) {
        data['facility'] = FACILITY[sysLogMsg.severity]
      }
      data['host'] = sysLogMsg.address
      log(e, data)
    }, {address: '0.0.0.0'})

  })
  //syslogd.server.bind({address: argv.udp_bind_address||'0.0.0.0', port:port})
  syslogd.listen(port, function (err) {
    consoleLogger.log('start syslog server ' + syslogd.server.address().address + ':' +port + ' ' + (err || ''))

  })
  return syslogd
}
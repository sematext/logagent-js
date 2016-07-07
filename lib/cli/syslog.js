'use strict'
var consoleLogger = require('../logger.js')
var Syslogd = require('syslogd')
// <183>Jul 7 12:03:34  localhost test1[23465]: test
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
    //consoleLogger.log (JSON.stringify(sysLogMsg))
    try {
    parseLine(sysLogMsg.msg, sysLogMsg.tag, function (e, data) {
      data['severity'] = SEVERITY[sysLogMsg.facility]
      data['syslog-tag'] = sysLogMsg.tag
      //if (/\#(.+)\#(.+)\#(.+?)\[(\d+)\]/) {
      if (sysLogMsg.severity) {
        data['facility'] = FACILITY[sysLogMsg.severity]
      }
      //}
      data['host'] = sysLogMsg.address
      log(e, data)
    }, {address: '0.0.0.0'})
  } catch (err) {
    console.log(err)
  }
    
  })
  //syslogd.server.bind({address: argv.udp_bind_address||'0.0.0.0', port:port})
  syslogd.listen(port, function (err) {
    consoleLogger.log('start syslog server ' + syslogd.server.address().address + ':' +port + ' ' + (err || ''))
  })
  return syslogd
}
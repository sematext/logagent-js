'use strict'
/*
 * See the NOTICE.txt file distributed with this work for additional information
 * regarding copyright ownership.
 * Sematext licenses logagent-js to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var consoleLogger = require('../../util/logger.js')
var Syslogd = require('syslogd')

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

function InputSyslog (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
}

InputSyslog.prototype.start = function () {
  var self = this
  if (this.config.port) {
    try {
      var port = this.config.udp || this.config.port
      var eventEmitter = this.eventEmitter
      var syslogd = Syslogd(function (sysLogMsg) {
        // consoleLogger.log (JSON.stringify(sysLogMsg))
        var context = {
          sourceName: sysLogMsg.tag || 'syslog',
          enrichEvent: {
            // note there is a bug in syslogd so facility and severty are mixed up
            severity: SEVERITY[sysLogMsg.facility] || SEVERITY[6],
            facility: FACILITY[sysLogMsg.severity] || FACILITY[16],
            'syslog-tag': sysLogMsg.tag,
            syslogClient: sysLogMsg.address
          },
          syslogClient: sysLogMsg.address,
          port: port
        }
        eventEmitter.emit('data.raw', sysLogMsg.msg, context)
      }, { address: self.config.address || '0.0.0.0' })
      syslogd.listen(
        self.config.port,
        function (err) {
          consoleLogger.log('Start syslog server ' + syslogd.server.address().address + ':' + self.config.port + ' ' + (err || ''))
        })
    } catch (err) {
      console.error(err)
    }
  }
}

InputSyslog.prototype.stop = function (cb) {
  cb()
}
module.exports = InputSyslog

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

// logging to stderr, to avoid conflict with stdin pipeline ...
var sm = require('stackman')
var stackman = sm({ sync: true })

var path = require('path')
var DEBUG = 3
var INFO = 2
var WARN = 1

var ERROR = 0
var chalk = require('chalk')

function logWithNodeModuleInfo (level, text) {
  var e = new Error('Oops!')
  stackman.callsites(e, function (err, callsites) {
    if (err) throw err
    var mi = path.basename(callsites[3].getFileName()) + ':' + callsites[3].getLineNumber() + ' '
    switch (level) {
      case ERROR:
        console.error(chalk.red('%s %s'), new Date().toISOString(), mi + text)
        break
      case WARN:
        console.error(chalk.yellow('%s %s'), new Date().toISOString(), mi + text)
        break
      case DEBUG:
        console.error(chalk.blue('%s %s'), new Date().toISOString(), mi + text)
        break
      default:
        console.error(chalk.green('%s %s'), new Date().toISOString(), mi + text)
        break
    }
  })
}

function logToConsole (level, text) {
  if (process.env.DEBUG) {
    logWithNodeModuleInfo(level, text)
  } else {
    var color = chalk.green('%s %s')
    switch (level) {
      case ERROR:
        color = chalk.red('%s %s')
        break
      case WARN:
        color = chalk.yellow('%s %s')
        break
      case DEBUG:
        color = chalk.blue('%s %s')
        break
      default:
        color = chalk.green('%s %s')
        break
    }
    console.error(color, new Date().toISOString(), text)
  }
}
function log (text) {
  logToConsole(INFO, 'pid[' + process.pid + '] ' + text)
}

function error (text) {
  logToConsole(ERROR, 'pid[' + process.pid + '] ' + text)
}

function debug (text) {
  if (process.env.DEBUG) {
    logToConsole(DEBUG, 'pid[' + process.pid + '] ' + text)
  }
}
function warn (text) {
  logToConsole(INFO, 'pid[' + process.pid + '] ' + text)
}
module.exports = {
  log: log,
  info: log,
  debug: debug,
  error: error,
  warn: warn,
  warning: warn
}

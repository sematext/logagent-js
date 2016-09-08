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
var stackman = sm({sync: true})

var path = require('path')
var DEBUG = 3
var INFO = 2
var WARN = 1

var ERROR = 0
var chalk = require('chalk')

function logWithNodeModuleInfo (level, text) {
  var e = new Error('Oops!')
  var stack = stackman(e)
  var mi = path.basename(stack.frames[3].getFileName()) + ':' + stack.frames[3].getLineNumber() + ' '
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
}

function logToConsole (level, text) {
  if (process.env.DEBUG) {
    logWithNodeModuleInfo(level, text)
  } else {
    switch (level) {
      case ERROR:
        console.error(chalk.red('%s %s'), new Date().toISOString(), text)
        break
      case WARN:
        console.error(chalk.yellow('%s %s'), new Date().toISOString(), text)
        break
      case DEBUG:
        console.error(chalk.blue('%s %s'), new Date().toISOString(), text)
        break
      default:
        console.error(chalk.green('%s %s'), new Date().toISOString(), text)
        break
    }
  }
}
function log (text) {
  var util = require('util')
  logToConsole(INFO, 'pid[' + process.pid + '] ' + text)
}

function error (text) {
  // if (process.env.LOG_TAIL_FILE_INFO) {
  logToConsole(ERROR, new Date().toISOString() + ' ' + text)
// }
}
function debug (text) {
  if (process.env.DEBUG) {
    logToConsole(DEBUG, text)
  }
}
function warn (text) {
  logToConsole(INFO, text)
}
module.exports = {
  log: log,
  info: log,
  debug: debug,
  error: error,
  warn: warn,
  warning: warn
}

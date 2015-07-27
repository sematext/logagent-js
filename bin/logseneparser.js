#!/usr/bin/env node

/*
 * @copyright Copyright (c) Sematext Group, Inc. - All Rights Reserved
 *
 * @licence logparser-js is free-to-use, proprietary software.
 * THIS IS PROPRIETARY SOURCE CODE OF Sematext Group, Inc. (Sematext)
 * This source code may not be copied, reverse engineered, or altered for any purpose.
 * This source code is to be used exclusively by users and customers of Sematext.
 * Please see the full license (found in LICENSE in this distribution) for details on its license and the licenses of its dependencies.
 */

var argv = require('minimist')(process.argv.slice(2))
var prettyjson = require('prettyjson')
var LogAnalyzer = require('../lib/index.js')
var la = new LogAnalyzer(argv.f || __dirname + '/../patterns.yml')
var readline = require('readline')
var begin = new Date().getTime()
var count = 0
var emptyLines = 0
var bytes = 0
var Logsene = require('logsene-js')
var logger = null

if (argv.t) {
  logger = new Logsene(argv.t, 'logs')
}

function log (err, data) {
  if (!data) {
    emptyLines++
    return
  }
  if (argv.t) {
    logger.log(data.level || data.severity + '' || 'info', data.message, data)
  }
  if (argv.s) {
    return
  }
  if (argv.p) {
    console.log(JSON.stringify(data, null, '\t'))
  } else if (argv.y) {
    console.log(prettyjson.render(data, {noColor: false}) + '\n')
  } else {
    console.log(JSON.stringify(data))
  }
  
}

var rl = readline.createInterface({
  input: process.stdin
})

rl.on('line', function (line) {
  bytes += line.length
  count++
  la.parseLine(line, 'httpd', log)
})

function terminate () {
  var duration = new Date().getTime() - begin
  var throughput = count / (duration / 1000)
  var throughputBytes = (bytes / 1024 / 1024) / (duration / 1000)

  if (argv.s) {
    console.error(duration + ' ms ' + count + ' lines parsed.  ' + throughput.toFixed(0) + ' lines/s ' + throughputBytes.toFixed(3) + ' MB/s - empty lines: ' + emptyLines)
  }
  process.exit()
}

rl.on('close', terminate)

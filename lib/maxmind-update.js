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
var os = require('os')
var path = require('path')
var init = false

module.exports = function updateMaxmind (debug, maxmindDbDir, cb) {
  var exec = require('child_process').exec
  var script = require.resolve('maxmind-geolite-mirror')
  if (maxmindDbDir !== null) {
    process.env.MAXMIND_DB_DIR = maxmindDbDir
  } else {
    process.env.MAXMIND_DB_DIR = process.env.MAXMIND_DB_DIR || path.join(os.tmpdir(), '/')
  }
  if (debug) {
    console.log('update maxmind db ' + process.env.MAXMIND_DB_DIR + 'GeoIPCity.dat')
  }
  var fileName = path.join(process.env.MAXMIND_DB_DIR, 'GeoIPCity.dat')
  if (init === false && require('child_process').execSync) {
    init = true
    try {
      updateSync(debug, fileName, script)
    } catch (updateErr) {
      if (debug) {
        console.log('Error in maxmind DB download')
      }
    }

    var tid = setInterval(function () { updateMaxmind(debug, maxmindDbDir) }, 1000 * 60 * 60)
    if (tid.unref) {
      tid.unref()
    }
    if (cb) {
      cb(null, fileName)
    }
  } else {
    exec(script,
      {
      env: process.env},
      function (err, stdout, stdin) {
        if (err) {
          console.log('Error in GeoIP database download: ' + err)
          return cb(err)
        }
        if (debug) {
          console.log(stdout)
        }
        if (!err && !init && cb !== null) {
          cb(null, path.join(process.env.MAXMIND_DB_DIR, 'GeoIPCity.dat'))
          init = true
        }
      })
  }
}

function updateSync (debug, maxmindDbDir, script) {
  var exec = null
  exec = require('child_process').execSync
  if (!exec) {
    // we might be on 0.10
    return null
  }
  var result = exec(script, {env: process.env, stdio: 'ignore'})
  if (debug) {
    console.log(result.toString())
  }
}

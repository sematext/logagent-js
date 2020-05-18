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
// var logger = require('..//util/logger.js')
function TokenMapper (indices) {
  this.indices = indices || []
  this.sourceCache = {}
}
TokenMapper.prototype.findToken = function (logSource) {
  var rv = this.sourceCache[logSource]
  if (rv) {
    return rv
  }
  Object.keys(this.indices).some(
    function someToken (token) {
      return this.indices[token].some(
        function someRegex (regex) {
          var r = new RegExp(regex)
          if (r.test(logSource)) {
            rv = token
            this.sourceCache[logSource] = token
            // stops looping
            return true
          } else {
            // continue with next
            return false
          }
        }.bind(this)
      )
    }.bind(this)
  )
  // logger.debug('found token for ' + logSource +': ' +rv)
  return rv
}
module.exports = TokenMapper

function test (done) {
  console.log('test')
  var tm = new TokenMapper({
    'TOKEN1-ABCD': ['.*access.*', '.*nginx.*'],
    TOKEN2: ['.*myApp.*', '.*test.*']
  })
  if (tm.findToken('/var/log/access.log') === 'TOKEN1-ABCD') {
    done()
  } else {
    done(new Error('token not found'))
  }
}
if (require.main === module) {
  test(console.log)
}

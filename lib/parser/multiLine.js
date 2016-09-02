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
function MultiLine (delimiter, cbf) {
  this.opt = {
    delimiter: delimiter,
    timeout: Number(process.env.LOGAGENT_MULTILINE_TIMEOUT_MS) || 200
  }
  this.lines = []
  this.state = 0
  this.consumer = cbf
  this.tid = 0
  if (delimiter) {
    this.tid = setInterval(this.lineTimeout.bind(this), Math.max(this.opt.timeout, 100))
    if (this.tid.unref) {
      this.tid.unref()
    }
  }
}

MultiLine.prototype.lineTimeout = function () {
  if (this.lines.length > 0 && (Date.now() - this.lastCall) > this.opt.timeout) {
    this.consumer(this.lines.join('\n'))
    this.lines.length = 0
    this.state = 0
  }
}

MultiLine.prototype.add = function (line) {
  if (!this.opt.delimiter) {
    return this.consumer(line)
  }
  this.lastCall = Date.now()
  if (this.lines.length === 0) {
    this.lines.push(line)
  } else { // reading in block
    if (this.opt.delimiter.test(line)) {
      this.consumer(this.lines.join('\n'))
      this.lines.length = 0
      this.lines.push(line)
    } else {
      this.lines.push(line)
    }
  }
}

module.exports = MultiLine

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
var consoleLogger = require('../logger.js')
module.exports=function (argv) {
  try {
    process.argv = [process.argv[0], process.argv[1], '--web-port', String(argv['rtailWebPort']), '--web-host', argv['rtailWebHost']||'localhost','--udp-port', String(argv['rtailPort'])]
    consoleLogger.log('start rtail server' + ' --web-port '+ argv['rtailWebPort'] + ' --web-host '+  argv['rtailWebHost']||'localhost'+' --udp-port '+ argv['rtailPort'])
    var rtailServer = require('rtail/cli/rtail-server.js')
  } catch (err) {
    consoleLogger.log(err.stack)
    consoleLogger.log('rtail is not installed. To start rtail server with logagent run:')
    consoleLogger.log('    npm i rtail -g')
    setTimeout(process.exit, 300)
  }
}
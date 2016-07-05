var consoleLogger = require('../logger.js')
module.exports=function (argv) {
  try {
    process.argv = [process.argv[0], process.argv[1], '--web-port', String(argv['rtailWebPort']), '--web-host', argv['rtailWebHost']||'localhost','--udp-port', String(argv['rtailPort'])]
    consoleLogger.log('start rtail server' + ' --web-port '+ argv['rtailWebPort'] + ' --web-host '+  argv['rtailWebHost']||'localhost'+' --udp-port '+ argv['rtailPort'])
    require('rtail/cli/rtail-server.js')
  } catch (err) {
    consoleLogger.log(err.stack)
    consoleLogger.log('rtail is not installed. To start rtail server with logagent run:')
    consoleLogger.log('    npm i rtail -g')
    setTimeout(process.exit, 300)
  }
}
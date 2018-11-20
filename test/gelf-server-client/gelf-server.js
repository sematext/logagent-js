var gelfserver = require('graygelf/server')
var server = gelfserver()
server.on('message', function (gelf) {
  console.log('received message', JSON.stringify(gelf))
})
server.listen(12201)

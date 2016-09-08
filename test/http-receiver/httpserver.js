var http = require('http')
var httpStatusToReturn = 200
var cluster = require('cluster')

if (cluster.isMaster) {
  cluster.fork()
  cluster.fork()
} else {
  http.createServer(function (req, res) {
    res.writeHead(httpStatusToReturn, {'Content-Type': 'text/plain'})
    var b = ''
    var lines = 0
    req.on('data', function (data) {
      // console.log(data.toString().substring(0, 10))
      b += data
      if (data)
        lines = lines + data.toString().split('\n').length
    })
    var body = JSON.stringify({error: 'bad request', status: 400})
    if (httpStatusToReturn === 200) {
      body = 'OK'
    }
    req.on('end', function () {
      console.log(new Date() + ' lines: ' + lines)
      res.end(body)
    })
  }).listen(9200, '127.0.0.1')
}

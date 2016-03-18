var os = require('os')
var path=require('path')
var init = false
module.exports = function updateMaxmind (debug, maxmindDbDir, cb) {
	var exec = require('child_process').exec
    var script = require.resolve ('maxmind-geolite-mirror')
    if (maxmindDbDir !== null)
    {
    	process.env.MAXMIND_DB_DIR = maxmindDbDir
    } else {
    	process.env.MAXMIND_DB_DIR = process.env.MAXMIND_DB_DIR || path.join(os.tmpdir(), '/')
    }
    if(debug) {
    	console.log('update maxmind db ' + process.env.MAXMIND_DB_DIR + 'GeoIPCity.dat')
    }
    exec(script, 
    	{env: process.env}, 
    	function (err, stdout, stdin) {
    	if (err) {
    		console.log(err)
    	}
    	if(debug) {
    		console.log(stdout)
    	}
    	if(!err && !init)
    	{
    		cb( path.join( process.env.MAXMIND_DB_DIR, 'GeoIPCity.dat') )
    		init=true
    	}
    })
    setInterval(updateMaxmind, 1000*60*60)
}



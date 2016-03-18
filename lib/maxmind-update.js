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
    var fileName = path.join( process.env.MAXMIND_DB_DIR, 'GeoIPCity.dat')
    if(init==false && require('child_process').execSync)
    {
    	updateSync(debug, fileName, script)
    	init = true
    	var tid = setInterval(function () {updateMaxmind(debug, maxmindDbDir)}, 1000*60*60)
    	if(tid.unref)
    	{
    		tid.unref()
    	}
    	if (cb) {
    		cb(fileName)	
    	}
    } else {
    	exec(script, 
    	    {
    	    	env: process.env}, 
		    	function (err, stdout, stdin) {
		    	if (err) {
		    		console.log(err)
		    	}
		    	if(debug) {
		    		console.log(stdout)
		    	}
		    	if(!err && !init && cb !== null)
		    	{
		    		cb( path.join( process.env.MAXMIND_DB_DIR, 'GeoIPCity.dat') )
		    		init=true
		    	}
		})
    }  
}

function updateSync (debug, maxmindDbDir, script) 
{
	var exec = null;
	exec = require('child_process').execSync
	if(!exec) {
		// we might be on 0.10
		return 
	}
	var result = exec(script, {env: process.env})
	if(debug) {
		console.log(result.toString())
	}
}



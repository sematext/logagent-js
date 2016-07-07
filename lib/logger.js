'use strict'
// logging to stderr, to avoid conflict with stdin pipeline ...
var sm = require('stackman')
var stackman = sm({sync:true})

var path = require('path')
var DEBUG=3
var INFO=2
var WARN=1
var ERROR=0
var chalk = require('chalk')

function logWithNodeModuleInfo (level, text) {
 	var e = new Error('Oops!')
 	var stack = stackman(e)
  	var mi = path.basename(stack.frames[3].getFileName()) + ':'+ stack.frames[3].getLineNumber() + ' '
	switch (level) {
	  	case ERROR: 
	  		console.error(chalk.bgRed('%s %s'), new Date().toISOString(), mi + text)
	  		break;
	  	case WARN:  
	  		console.error(chalk.bgYellow('%s %s'), new Date().toISOString(),mi + text)
	  		break;
	  	case DEBUG:  
	  		console.error(chalk.bgBlue('%s %s'), new Date().toISOString(),mi + text);
	  		break;
	  	default:  
	  		console.error(chalk.bgBlack.green('%s %s'), new Date().toISOString(),mi + text);
	  		break; 
  	  }		
}

function logToConsole(level, text) {
	if (process.env.DEBUG) {
		logWithNodeModuleInfo(level,text)	
	} else {
	  switch (level) {
	  	case ERROR: 
	  		console.error(chalk.bgRed('%s %s'), new Date().toISOString(),text)
	  		break;
	  	case WARN:  
	  		console.error(chalk.bgYellow('%s %s'), new Date().toISOString(),text)
	  		break;
	  	case DEBUG:  
	  		console.error(chalk.bgBlue('%s %s'), new Date().toISOString(),text);
	  		break;
	  	default:  
	  		console.error(chalk.bgBlack.green('%s %s'), new Date().toISOString(),text);
	  		break; 
  	  }	
	}
}
function log (text) {
  logToConsole(INFO, text)
} 

function error (text) {
  //if (process.env.LOG_TAIL_FILE_INFO) {
  logToConsole(ERROR,new Date().toISOString() + ' ' + text)
  //}
}
function debug (text) {
  if (process.env.LOG_TAIL_FILE_INFO) {
    logToConsole(DEBUG,text)
  }
}
function warn (text) {
  logToConsole(INFO, text)
}
module.exports = {
	log: log,
	info: log,
	debug: debug,
	error: error,
	warn: warn,
	warning: warn
}
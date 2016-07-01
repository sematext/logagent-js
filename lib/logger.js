'use strict'
function log (text) {
  //if (process.env.LOG_TAIL_FILE_INFO) {
  console.log(new Date().toISOString() + ' ' + text)
  //}
}
function error (text) {
  //if (process.env.LOG_TAIL_FILE_INFO) {
  console.error(new Date().toISOString() + ' ' + text)
  //}
}
function debug (text) {
  if (process.env.LOG_TAIL_FILE_INFO) {
    console.log(new Date().toISOString() + ' ' + text)
  }
}

module.exports = {
	log: log,
	debug: debug,
	error: error
}
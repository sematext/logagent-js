#!/usr/bin/env node
'use strict'
try {
  if (process.argv[2] === '-install') {
    var laCmd = process.mainModule.filename
    // var exec = require('child_process').execSync
    // exec('powershell -command "Set-ItemProperty -Path \'Registry::HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Control\\Session Manager\\Environment\' -Name LOGAGENT_CONFIG –Value \'' + process.argv[3] +'\'',{stdio: [0,1,2]})
    console.log(laCmd)
    let Service = require('node-windows').Service
    let svc = new Service({
      name: 'Logagent',
      description: 'Sematext Logagent',
      script: laCmd,
      wait: 2,
      grow: 0.5
    })
    svc.on('error', console.log)
    // Listen for the "install" event, which indicates the
    // process is available as a service.
    svc.on('install', function () {
      console.log('Logagent service installed')
      svc.start()
    })
    svc.on('start', function () {
      console.log('Logagent service started')
    })
    svc.install()
  } else if (process.argv[2] === '-uninstall') {
    let Service = require('node-windows').Service
    let svc = new Service({
      name: 'Logagent',
      description: 'Sematext Logagent',
      script: process.mainModule.filename
    })
    svc.on('uninstall', function () {
      console.log('Service Logagent removed.')
    })
    svc.uninstall()
  } else {
    if (process.argv.join(',').indexOf('--config') === -1) {
      // use default config
      process.argv.push('--config')
      process.argv.push(
        process.env.LOGAGENT_CONFIG ||
          process.env.ProgramData + '\\Sematext\\logagent.conf'
      )
    }
    var la = new (require('./logagent.js'))()
    if (!la) {
      throw new Error('could not load logagent.js')
    }
  }
} catch (err) {
  console.log(err.stack)
}

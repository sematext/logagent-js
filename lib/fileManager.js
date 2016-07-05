'use strict'
var path = require('path')
var fs = require('fs')
var os = require('os')
var Tail = require('tail-forever')
var glob = require('glob')
var logger = require('./logger.js')

function FileManager (options) {
  this.filePointers = this.readFilePointers()
  this.filesToWatch = []
  this.fileNamesToWatch = []
  this.options = options
  this.scanCounter = 0
  this.stats = {}
  this.cliArgs = options.cliArgs || {}
  this.sigTermHandled = false
}

function getFilesizeInBytes (filename) {
  try {
    var stats = fs.statSync(filename)
    return stats.size
  } catch (fsErr) {
    return -1
  }
}

FileManager.prototype.tailFiles = function (fileList) {
  fileList.forEach(this.tailFile.bind(this))
}
FileManager.prototype.getTempDir = function () {
  return process.env.LOGSENE_TMP_DIR || os.tmpDir()
}

FileManager.prototype.getTailPosition = function (file) {
  var storedPos = this.filePointers[file]
  if (!storedPos) {
    logger.debug('no position stored for ' + file)
    // tail from end of file
    return {start: getFilesizeInBytes(file)}
  } else {
    var fd = fs.openSync(file, 'r')
    var stat = fs.fstatSync(fd)
    if (stat.ino === storedPos.inode) {
      return {start: storedPos.pos, inode: storedPos.inode}
    } else {
      logger.debug('Watching file ' + file + ' inode changed, set tail position = 0')
      return {start: 0}
    }
  }
}

FileManager.prototype.tailFilesFromGlob = function  (globPattern, scanTime) {
  if (globPattern) {
    glob(globPattern, {strict: false, silent: false}, function (err, files) {
      if (!err) {
        this.tailFiles(files)
      } else {
        logger.error('Error in glob file patttern ' + globPattern + ': ' + err.message)
      }
    }.bind(this))
    if (!this.globPattern && scanTime>0) {
      this.globPattern=globPattern
      setInterval(function () {
        this.scanCounter = 1
        this.tailFilesFromGlob(this.globPattern, scanTime)
      }.bind(this), scanTime)
    }
  }
}

FileManager.prototype.tailFile = function (file) {
  var tail = null
  var pos = {start:0}
  if (this.fileNamesToWatch.indexOf(file) > -1) {
    // check if we watch this file already
    return null
  } else {
    
  }
  try {
    pos = this.getTailPosition(file)
  } catch (error) {
    // file might not exists, we ignore it and start watching 
    pos = {start: 0}
  }
  if (this.scanCounter > 0) {
     // a new file matched the glob pattern
     // reading from begin of file
     logger.log('New file detected: ' + file)
     pos = {start: 0}
  }
  try {
    if (pos.start == -1) {
      // there was no postion stored, let's start from the beginning
      // throw new Error('File ' + file + ' does not exist.')
      pos.start = 0
    }
    tail = new Tail(file, pos)
    this.filesToWatch.push(tail)
    this.fileNamesToWatch.push(file)
    tail.on('line', function (line) {
      this.stats[file] = (this.stats[file]||0) +1
      this.options.parseLine(line, path.basename(file), this.options.log)
    }.bind(this))
    tail.once('error', function (error) {
      logger.log('ERROR tailing file ' + file + ': ' + error)
    }.bind(this))
    logger.log('Watching file:' + file + ' from position: ' + pos.start)
    return tail
  } catch (error) {
    //log('ERROR tailing file ' + file + ': ' + error)
    return null
  }
}

FileManager.prototype.terminate = function () {
  if (!this.sigTermHandled) {
    this.sigTermHandled=true
    this.savePositions()
  }
}
 
FileManager.prototype.savePositions = function () {
  var filePositions = this.filesToWatch.map(function (tailObj) {
    try {
      var position = tailObj.unwatch()
      position.fileName = tailObj.filename
      logger.log('Stop watching ' + tailObj.filename + ' inode: ' + position.inode + ' pos:' + position.pos)
      return position 
    } catch (fileExistsError) {
      // file got removed
      return null
    }
  })
  try {
    var fileName = path.join(this.getTempDir(), 'logagentTailPointers.json')
    fs.writeFileSync(fileName, JSON.stringify(filePositions))
    logger.log('File positions stored in: ' + fileName)
  } catch (err) {
    logger.log('error writing file pointers:' + err)
  }
}

FileManager.prototype.readFilePointers = function () {
  var filePointers = {}
  try {
    var fileName = path.join(this.getTempDir(), 'logagentTailPointers.json')
    var fp = fs.readFileSync(fileName)
    var filePointerArr = JSON.parse(fp)
    filePointerArr.forEach(function (f) {
      filePointers[f.fileName] = {pos: f.pos, inode: f.inode}
    })
    if (Object.keys(filePointers).length>0) {
      logger.debug(JSON.stringify(filePointers,null,'\t'))
    }
    fs.unlinkSync(fileName)
  } catch (err) {
    logger.log('Error reading file pointers: ' + err.stack)
  }
  return filePointers
}

module.exports = FileManager

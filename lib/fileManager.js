'use strict'
var path = require('path')
var fs = require('fs')
var os = require('fs')
var Tail = require('tail-forever')

function log(text) {
  if (process.env.LOG_TAIL_FILE_INFO) {
    console.log(text)
  }
}
function FileManager (options) {
  this.filePointers = this.readFilePointers()
  this.filesToWatch = []
  this.options = options
}

function getFilesizeInBytes (filename) {
  var stats = fs.statSync(filename)
  var fileSizeInBytes = stats['size']
  return fileSizeInBytes
}

FileManager.prototype.tailFiles = function (fileList) {
  fileList.forEach(this.tailFile.bind(this))
}
FileManager.prototype.getTempDir = function () {
  return process.env.LOGSENE_TMP_DIR || os.getTempDir()
}

FileManager.prototype.getTailPosition = function (file) {
  var storedPos = this.filePointers[file]
  if (!storedPos) {
    log('no position stored for ' + file)
    return {start: getFilesizeInBytes(file)}
  } else {
    var fd = fs.openSync(file, 'r')
    var stat = fs.fstatSync(fd)

    if (stat.ino === storedPos.inode) {
      return {start: storedPos.pos, inode: storedPos.inode}  
    } else {
      log('Watching file ' + file + ' inode changed, set tail position = 0') 
      return {start: 0, inode: storedPos.inode} 
    }
  }
}

FileManager.prototype.tailFile = function (file) {
  var tail = null 
  try {
      var pos = this.getTailPosition(file)
      tail = new Tail(file, pos)
      this.filesToWatch.push(tail)
      tail.on('line', function (line) {
        this.options.parseLine(line, file, this.options.log)
      }.bind(this))
      tail.on('error', function (error) {
        log('ERROR tailing file '+file+': ' + error)
      })
      console.log('Watching file:' + file +' from position: ' + pos.start)  
      return tail
  } catch (error) {
    console.log('ERROR tailing file '+file+': ', error)
    return null
  }
}

FileManager.prototype.terminate = function () {
  var filePositions = this.filesToWatch.map(function (tailObj) {
    var position = tailObj.unwatch()
    position.fileName = tailObj.filename
    console.log('unwatch ' + tailObj.filename + ' inode: ' + position.inode + ' pos:' +position.pos) 
    return position
  })  
  try {
    var fileName = path.join(this.getTempDir(), 'logagentTailPointers.json')
    fs.writeFileSync(fileName,JSON.stringify(filePositions))  
    log("File positions stored in: " + fileName)
  } catch (err) {
    log('error writing file pointers:' + err)
  }
}

FileManager.prototype.readFilePointers = function () {
  var filePointers = {}
  try {
    var fp = fs.readFileSync(path.join(this.getTempDir(), 'logagentTailPointers.json'))
    var filePointerArr = JSON.parse(fp)
    filePointerArr.forEach(function (f) {
      filePointers[f.fileName]={pos: f.pos, inode: f.inode}
    })
    log(filePointers)
  } catch (err) {
    log('Error reading file pointers: ' + err)
  }
  return filePointers
}

module.exports = FileManager
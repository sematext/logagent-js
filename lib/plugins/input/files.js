'use strict'
/*
 * See the NOTICE.txt file distributed with this work for additional information
 * regarding copyright ownership.
 * Sematext licenses logagent-js to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var path = require('path')
var fs = require('fs')
var os = require('os')
var Tail = require('tail-forever')
var glob = require('glob')
var logger = require('../../util/logger.js')

function InputFile (options, eventEmitter) {
  this.eventEmitter = eventEmitter
  this.options = options
  this.filesToWatch = []
  this.fileNamesToWatch = []
  this.scanCounter = 0
  this.stats = {}
  this.sigTermHandled = false
  this.laStats = require('../../core/printStats')
  this.laStats.fileManger = this
  this.activated = false
}

function getFilesizeInBytes (filename) {
  try {
    var stats = fs.statSync(filename)
    return stats.size
  } catch (fsErr) {
    return -1
  }
}

InputFile.prototype.stop = function (cb) {
  this.terminate()
  cb()
}
InputFile.prototype.start = function () {
  var globPattern = this.options.glob || process.env.GLOB_PATTERN
  if (this.options.args && this.options.args.length > 0) {
    this.filePointers = this.readFilePointers()
    // tail files
    this.tailFiles(this.options.args)
    this.activated = true
  }
  if (globPattern) {
    this.activated = true
    if (!this.filePointers) {
      this.filePointers = this.readFilePointers()
    }
    // remove quotes from shell script
    globPattern = globPattern.replace(/"/g, '').replace(/'/g, '').replace(/\s/g, '')
    logger.log('using glob pattern: ' + globPattern)
    this.tailFilesFromGlob(globPattern, 60000)
  }
}

InputFile.prototype.tailFiles = function (fileList) {
  fileList.forEach(this.tailFile.bind(this))
}
InputFile.prototype.getTempDir = function () {
  return this.options.diskBufferDir || process.env.LOGSENE_TMP_DIR || os.tmpDir()
}

InputFile.prototype.getTailPosition = function (file) {
  var storedPos = this.filePointers[file]
  if (!storedPos) {
    logger.debug('no position stored for ' + file)
    // tail from end of file
    return {start: this.options.tailStartPosition || getFilesizeInBytes(file)}
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

InputFile.prototype.tailFilesFromGlob = function (globPattern, scanTime) {
  if (globPattern) {
    glob(globPattern, {
      strict: false,
      silent: false
    }, function globCb (err, files) {
      if (!err) {
        this.tailFiles(files)
      } else {
        logger.error('Error in glob file patttern ' + globPattern + ': ' + err.message)
      }
    }.bind(this))
    if (!this.globPattern && scanTime > 0) {
      this.globPattern = globPattern
      setInterval(function scanFilesTimer () {
        this.scanCounter = 1
        this.tailFilesFromGlob(this.globPattern, scanTime)
      }.bind(this), scanTime)
    }
  }
}

InputFile.prototype.tailFile = function (file) {
  var tail = null
  var pos = {start: 0}
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
    var context = {sourceName: file, startPos: pos}
    tail.on('line', function (line) {
      this.stats[file] = (this.stats[file] || 0) + 1
      this.eventEmitter.emit('data.raw', line, context)
    }.bind(this))
    tail.once('error', function (error) {
      var errMessage = 'ERROR tailing file ' + file + ': ' + error
      logger.error(errMessage)
      this.eventEmitter.emit('error.plugin.input.file', errMessage, {file: file, error: error})
    }.bind(this))
    logger.log('Watching file:' + file + ' from position: ' + pos.start)
    return tail
  } catch (error) {
    // log('ERROR tailing file ' + file + ': ' + error)
    return null
  }
}

InputFile.prototype.terminate = function () {
  if (!this.sigTermHandled && this.activated) {
    this.sigTermHandled = true
    this.savePositions()
  }
}

InputFile.prototype.savePositions = function () {
  var filePositions = this.filesToWatch.map(function filesToWatchMap (tailObj) {
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

InputFile.prototype.readFilePointers = function () {
  var filePointers = {}
  try {
    var fileName = path.join(this.getTempDir(), 'logagentTailPointers.json')
    var fp = fs.readFileSync(fileName)
    var filePointerArr = JSON.parse(fp)
    filePointerArr.forEach(function storeFp (f) {
      filePointers[f.fileName] = {pos: f.pos, inode: f.inode}
    })
    if (Object.keys(filePointers).length > 0) {
      logger.debug(JSON.stringify(filePointers, null, '\t'))
    }
    fs.unlinkSync(fileName)
  } catch (err) {
    logger.log('No stored file postions (file not found):' + fileName)
  }
  return filePointers
}

module.exports = InputFile

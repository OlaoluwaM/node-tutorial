// Library for storing and rotating logs

// Dependencies
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Container for the module
const lib = {
  // Base directory of the logs folder
  baseDir: path.join(__dirname, '/../.logs/'),

  // Append a string to a file. Create the file if it does not exist.
  append(file, str, callback) {
    // Open the file
    fs.open(`${this.baseDir}${file}.log`, 'a', (err, fileDescriptor) => {
      if (!err && fileDescriptor) {
        // Append to the file and close it
        fs.appendFile(fileDescriptor, `${str}\n`, err => {
          if (!err) {
            fs.close(fileDescriptor, err => {
              if (!err) {
                callback(false);
              } else callback('Error closing file');
            });
          } else callback('Error appending to file');
        });
      } else callback('Could not open file for appending');
    });
  },

  // List all the logs, and optionally include the compressed logs
  list(includeCompressedLogs, callback) {
    fs.readdir(this.baseDir, (err, data) => {
      if ((!err, data, data.length > 0)) {
        const trimmedFileNames = [];
        data.forEach(fileName => {
          // Add the .log files
          if (fileName.includes('.log')) {
            trimmedFileNames.push(fileName.replace('.log', ''));
          }

          // Add on the .gz files
          if (fileName.includes('.gz.b64 ') && includeCompressedLogs) {
            trimmedFileNames.push(fileName.replace('.gz.b64', ''));
          }
        });
        callback(false, trimmedFileNames);
      } else callback(err, data);
    });
  },
  // Compress the contents of one .log file into a .gz.b64 file within the same directly
  compress(logId, newField, callback) {
    const sourceFile = logId + '.log';
    const desFile = `${newField}.gz.b64`;

    // Read the source file
    fs.readFile(`${this.baseDir}${sourceFile}`, 'utf8', (err, inputString) => {
      if (!err && inputString) {
        // Compress the data using gzip
        zlib.gzip(inputString, (err, buffer) => {
          if (!err && buffer) {
            // Send the new compressed data to the destination file
            fs.open(`${lib.baseDir}${desFile}`, 'wx', (err, fileDescriptor) => {
              if (!err && fileDescriptor) {
                // Continue to write to destination file
                fs.writeFile(fileDescriptor, buffer.toString('base64'), err => {
                  if (!err) {
                    // Close the destination file
                    fs.close(fileDescriptor, err => {
                      if (!err) {
                        callback(false);
                      } else callback(err);
                    });
                  }
                  callback(err);
                });
              } else callback(err);
            });
          } else callback(err);
        });
      } else callback(err);
    });
  },

  // Decompress the contents of .gz.b64 file into string variable
  decompress(fileId, callback) {
    const fileName = `${fileId}.gz.b64`;
    fs.readFile(`${this.baseDir}${fileName}`, 'utf8', (err, str) => {
      if (!err && str) {
        // Decompress the data
        const inputBuffer = Buffer.from(str, 'base64');
        zlib.unzip(inputBuffer, (err, outputBuffer) => {
          if (!err && outputBuffer) {
            // Callback
            const string = outputBuffer.toString();
            callback(false, string);
          } else callback(err);
        });
      } else callback(err);
    });
  },

  // Truncate a log file
  truncate(logId, callback) {
    fs.truncate(`${this.baseDir}${logId}.log`, 0, err => {
      if (!err) {
        callback(false);
      } else callback(err);
    });
  },
};

// Export the module
module.exports = lib;

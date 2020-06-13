// Library for storing and editing data

// Dependencies
const fs = require('fs');
const helpers = require('../lib/helpers');

// Used to normalize the path to different directories
const path = require('path');

// Container for the module (to be exported)
const lib = {
  // Base directory of data folder
  baseDir: path.join(__dirname, '/../.data/'),
  generatePath(dir, file) {
    return `${this.baseDir}${dir}/${file}.json`;
  },

  // Write data to a file
  create(dir, file, data, callback) {
    let result = false;
    // Open the file for writing
    fs.open(this.generatePath(dir, file), 'wx', (err, fileDescriptor) => {
      try {
        if (err) throw 'Could not create new file, it may already exist';
        // Convert data to storing
        const stringData = JSON.stringify(data);

        // Write to file and close it
        fs.writeFile(fileDescriptor, stringData, err => {
          if (err) throw 'Error writing to new file';

          fs.close(fileDescriptor, err => {
            if (err) throw 'Error closing new file';

            console.log('Completed action, ' + file + '.json created');
          });
        });
      } catch (error) {
        console.error(error);
        result = error;
      } finally {
        callback(result);
      }
    });
  },

  // Read data from a file
  read(dir, file, callback) {
    fs.readFile(this.generatePath(dir, file), 'utf-8', (err, data) => {
      try {
        if (err) throw "Couldn't read file";
        callback(false, helpers.parseJsonToObject(data));
      } catch (error) {
        console.log(`This was the error: ${error}`);
        callback(error);
      }
    });
  },

  // Update data inside existing file
  update(dir, file, data, callback) {
    let result = false;
    // Open file for writing
    fs.open(this.generatePath(dir, file), 'r+', (err, fileDescriptor) => {
      try {
        if (err) throw 'Could not open the file for updating, it may not exist yet';

        // Convert data to storing
        let stringData = JSON.stringify(data);

        // Truncate the file
        fs.ftruncate(fileDescriptor, err => {
          if (err) throw 'Error truncating file';

          // Write to the file and close it
          fs.writeFile(fileDescriptor, stringData, err => {
            if (err) throw 'Error writing to existing file';

            fs.close(fileDescriptor, err => {
              if (err) throw 'Error closing the file';
              console.log('Update Completed');
            });
          });
        });
      } catch (error) {
        console.log(error);
        result = error;
      } finally {
        callback(result);
      }
    });
  },

  // Delete a file
  delete(dir, file, callback) {
    // Unlink the file
    fs.unlink(this.generatePath(dir, file), err => {
      callback(err);
    });
  },

  list(dir, callback) {
    fs.readdir(`${this.baseDir}${dir}/`, (err, data) => {
      if (!err && data.length > 0) {
        const trimmedFileNames = [];
        data.forEach(fileName => {
          trimmedFileNames.push(fileName.replace('.json', ''));
        });
        callback(false, trimmedFileNames);
      } else callback(err, data);
    });
  },
};

// Export the module
module.exports = lib;

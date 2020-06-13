// Worker related tasks

// Dependencies
const path = require('path');
const fs = require('fs');
const _data = require('./data');
const https = require('https');
const http = require('http');
const helpers = require('./helpers');
const url = require('url');
const myHelpers = require('../helpers/helpers');
const _logs = require('./logs');
const utils = require('util');
const debug = utils.debuglog('workers');

// Constants
const { validateType, extractedPayloadDataObj, colorizeLog } = myHelpers;

// Instantiate the worker object
const workers = {
  // Lookup all the checks, get their data, and send to validator

  gatherAllChecks() {
    // Get all the checks that exist

    _data.list('checks', (err, checks) => {
      if (!err && checks && checks.length > 0) {
        checks.forEach(check => {
          // Read the check data
          _data.read('checks', check, (err, originalCheckData) => {
            if (!err) {
              // Pass the data to check validator
              this.validateCheckData(originalCheckData);
            } else debug("Error reading one of the check's data");
          });
        });
      } else {
        debug('Error: Could not find any checks to process');
      }
    });
  },

  // Sanity checking the check-data
  validateCheckData(originalCheckData) {
    originalCheckData = validateType(originalCheckData, 'object') ? originalCheckData : false;
    const {
      id,
      phone,
      protocol,
      url,
      method,
      successCodes,
      timeoutSeconds,
    } = extractedPayloadDataObj(originalCheckData);

    // Set the keys that may not be set (if the workers have never seen this check before)
    originalCheckData.state =
      validateType(originalCheckData?.state, 'string') &&
      ['up', 'down'].includes(originalCheckData.state)
        ? originalCheckData.state
        : 'down';

    originalCheckData.lastChecked =
      validateType(originalCheckData?.lastChecked, 'number') && originalCheckData.lastChecked > 0
        ? originalCheckData.lastChecked
        : false;

    const objKeys = Object.keys(originalCheckData).filter(key => {
      return key === 'state' ? false : key === 'lastChecked' ? false : true;
    });

    // If all the checks pass pass all the data to the next step in the process
    const allPass = objKeys.every(key => !!originalCheckData[key]);

    if (allPass) {
      this.performChecks(originalCheckData);
    } else {
      debug('Error: One of the checks is not formatted properly skipping it.');
    }
  },

  // Perform the checks, send the originalCheckData and the outcome to the next step in the process
  performChecks(originalCheckData) {
    const checkOutcome = {
      error: false,
      responseCode: false,
    };

    // Mark that the outcome has not been sent yet
    let outcomeSent = false;

    // Parse the hostname and the path out of the original check data
    const parsedUrl = url.parse(`${originalCheckData.protocol}://${originalCheckData.url}`, true);
    const hostname = parsedUrl.hostname;

    // The reason for using the "path" instead of  "pathname" is because we want access to the query string
    const path = parsedUrl.path;

    // Construct the request
    const requestDetails = {
      protocol: originalCheckData.protocol + ':',
      hostname,
      method: originalCheckData.method.toUpperCase(),
      path,
      timeout: originalCheckData.timeoutSeconds * 1000,
    };

    // Instantiate the request object suing either http or https module
    const _moduleToUse = originalCheckData.protocol === 'http' ? http : https;

    const req = _moduleToUse.request(requestDetails, res => {
      // Grab the status of the sent request
      const status = res.statusCode;

      // Update the check outcome and pass the data along
      checkOutcome.responseCode = status;
      if (!outcomeSent) {
        workers.processCheckOutcome(originalCheckData, checkOutcome);
        outcomeSent = true;
      }
    });

    // Bind to the error event so it doesn't get thrown
    req.on('error', err => {
      // Update the check outcome and pass the data along
      checkOutcome.error = {
        error: true,
        value: err,
      };
      if (!outcomeSent) {
        workers.processCheckOutcome(originalCheckData, checkOutcome);
        outcomeSent = true;
      }
    });

    // Bind to the timeout event
    req.on('timeout', () => {
      // Update the check outcome and pass the data along
      checkOutcome.error = {
        error: true,
        value: 'timeout',
      };
      if (!outcomeSent) {
        workers.processCheckOutcome(originalCheckData, checkOutcome);
        outcomeSent = true;
      }
    });

    // Send the request
    req.end();
  },

  // Process the check outcome and update the check data as needed, and trigger an alert to the user if needed
  // Special  logic for accommodating a check that has never been tested before, we don't want to be alerted for that one
  processCheckOutcome(originalCheckData, checkOutcome) {
    // Decide if the check is considered up or down
    const state =
      !checkOutcome.error &&
      checkOutcome.responseCode &&
      originalCheckData.successCodes.includes(checkOutcome.responseCode)
        ? 'up'
        : 'down';

    // Decide if an alert is warranted
    const alertWarranted =
      originalCheckData.lastChecked && originalCheckData.state !== state ? true : false;

    // Log the outcome of the check
    const timeOfCheck = Date.now();
    this.log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck);

    // Update the check data
    const newCheckData = originalCheckData;
    newCheckData.state = state;
    newCheckData.lastChecked = timeOfCheck;

    // Save updates
    _data.update('checks', newCheckData.Id, newCheckData, err => {
      if (!err) {
        if (alertWarranted) {
          this.alertUserToStatusChange(newCheckData);
        } else debug('Check outcome has not changed');
      } else debug('Error trying to save updates to one of the checks');
    });
  },

  // Alert the user as to a change in their check status
  alertUserToStatusChange(newCheckData) {
    const msg = `Alert: Your check for: ${newCheckData.method.toUpperCase()} ${
      newCheckData.protocol
    }://${newCheckData.url} is currently ${newCheckData.state}`;

    helpers.sendTwilioSms(newCheckData.userPhone, msg, err => {
      if (!err) {
        debug('Success: User was alerted to a status change to their check via sms', msg);
      } else {
        debug('Error, could not sms result to user with state change in their check');
      }
    });
  },

  log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck) {
    // Form the log data
    const logData = {
      check: originalCheckData,
      outcome: checkOutcome,
      state,
      alert: alertWarranted,
      time: timeOfCheck,
    };

    // Convert data to a string
    const logString = JSON.stringify(logData, null, 2);

    // Determine log file name
    const logFileName = originalCheckData.Id;

    // Append the log string to the file
    _logs.append(logFileName, logString, err => {
      if (!err) {
        debug('Logging to file succeeded');
      } else {
        debug('Logging to file failed');
      }
    });
  },

  // Timer to execute the worker-process once per minute
  loop() {
    setInterval(() => {
      this.gatherAllChecks();
    }, 1000 * 60);
  },

  // Rotate/Compress log files
  rotateLogs() {
    // List all non-compressed log files
    _logs.list(false, (err, logs) => {
      if (!err && logs && logs.length > 0) {
        logs.forEach(logName => {
          // Compress the data to a different file
          const logId = logName.replace('.log', '');
          const newFileId = `${logId}-${Date.now()}`;
          _logs.compress(logId, newFileId, err => {
            if (!err) {
              // Truncate the log, emptying out the original log file after rotating it
              _logs.truncate(logId, err => {
                if (!err) {
                  debug('Success truncating log file');
                } else {
                  debug('Error truncating logFile');
                }
              });
            } else {
              debug('Error: compressing one of the log file', err);
            }
          });
        });
      } else debug('Error: could not find any logs to rotate');
    });
  },

  // Timer to execute the log-rotation process once per day
  logRotationLoop() {
    setInterval(() => {
      this.rotateLogs();
    }, 1000 * 3600 * 24);
  },

  init() {
    // Send to console in yellow
    console.log(colorizeLog([33, 89], 'Background workers running'));

    // Execute all the checks immediately
    this.gatherAllChecks();

    // Call the loop so the checks will execute later on
    this.loop();

    // Compress all the logs immediately
    this.rotateLogs();

    // Call the compression loop so logs will be compressed later on
    this.logRotationLoop();
  },
};

// Export the module
module.exports = workers;

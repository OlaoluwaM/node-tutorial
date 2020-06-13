// Helpers for various tasks

// Dependencies
const { validateType } = require('../helpers/helpers');
const crypto = require('crypto');
const config = require('./config');
const https = require('https');
const queryString = require('querystring');

// Container for all the helpers
const helpers = {
  // Create a SHA256 hash
  hash(str) {
    if (!validateType(str, 'string')) return false;
    return crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
  },

  // Parse a JSON string to an object in all cases, without throwing
  parseJsonToObject(str) {
    try {
      const obj = JSON.parse(str);
      return obj;
    } catch (error) {
      return {};
    }
  },

  // Create a string of random alphanumeric characters, of a given length
  createRandomString(len) {
    if (validateType(len, 'number') && len > 0) {
      // Define all possible characters that could go into a string
      const possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';
      // Start the final string
      let str = '';
      for (let i = 0; i < len; i++) {
        // Get a random character from the possible character string
        const randomChar = possibleCharacters.charAt(
          Math.floor(Math.random() * possibleCharacters.length)
        );

        // Append this character to the final string
        str += randomChar;
      }
      return str;
    }
  },
  sendTwilioSms(phone, msg, callback) {
    // Validate parameters
    phone = validateType(phone, 'string') && phone.trim().length === 10 ? phone.trim() : false;
    msg =
      validateType(msg, 'string') && msg.trim().length > 0 && msg.trim().length <= 1600
        ? msg.trim()
        : false;

    if (phone && msg) {
      // Configure the request payload
      const payload = {
        From: config.twilio.fromPhone,
        To: `+1${phone}`,
        Body: msg,
      };

      // Stringify the payload
      const stringPayload = queryString.stringify(payload);

      // Configure the request details
      const requestDetails = {
        protocol: 'https:',
        hostname: 'api.twilio.com',
        method: 'POST',
        path: `/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
        auth: `${config.twilio.accountSid}: ${config.twilio.authToken}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(stringPayload),
        },
      };

      // Instantiate the request object
      const req = https.request(requestDetails, res => {
        // Grab the status of the sent request
        const { statusCode } = res;
        // Callback to original caller successfully, if call went through
        if (statusCode === 200 || statusCode === 201) {
          callback(false);
        } else callback('Status code returned was ' + statusCode);
      });

      // Bind to the error event so it doesn't get throw
      req.on('error', err => callback(err));

      // Add the payload
      req.write(stringPayload);

      // End the request
      req.end();
    } else callback('Given parameters were missing or invalid');
  },
};

// Export container
module.exports = helpers;

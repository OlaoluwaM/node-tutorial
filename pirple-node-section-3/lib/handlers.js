// Request handlers

// Dependencies
const myHelpers = require('../helpers/helpers');
const _data = require('./data');
const helpers = require('./helpers');
const config = require('./config');

// Constants
const { validateType, acceptableMethods, extractedPayloadDataObj } = myHelpers;

function generalHandler(type) {
  return (data, callback) => {
    if (!acceptableMethods.includes(data.method)) {
      callback(405);
      return;
    }
    handlers[`_${type}`][data.method](data, callback);
  };
}

function authenticate(headers, extraData, callback, callbackInt) {
  // Get the token from the headers
  const token = validateType(headers.token, 'string') ? headers.token : false;

  // Verify that the given token is valid for the phone number
  handlers._tokens.verifyToken(token, extraData, tokenIsValid => {
    if (tokenIsValid) {
      callbackInt(extraData);
    } else callback(403, { Error: 'Missing required token in header, or token is invalid' });
  });
}

const errorObj = {
  '400v1': { Error: 'User already exists' },
  '400v2': { Error: 'Missing required fields' },
};
// Define the handlers
const handlers = {
  ping(_, callback) {
    callback(200);
  },

  //Not found handler
  notFound(_, callback) {
    callback(404);
  },

  // Users
  users(data, callback) {
    generalHandler('users')(data, callback);
  },

  // Container for all the user methods
  _users: {
    /**
     * @name Users - post
     * @param {{}} data
     * @param {Function} callback
     * @requires {firstName, lastName, phone, password, tosAgreement}
     * Optional data: none
     */

    post(data, callback) {
      // Check all required field are filled out
      const { payload } = data;
      const { firstName, lastName, phone, password, tosAgreement } = extractedPayloadDataObj(
        payload
      );

      if (firstName && lastName && phone && password && tosAgreement) {
        // Make sure that the user doesn't already exist
        _data.read('users', phone, err => {
          if (!err) {
            callback(400, errorObj['400v1']);
            return;
          }

          // Hash the password
          const hashedPassword = helpers.hash(password);

          if (!hashedPassword) {
            callback(500, { Error: 'Could not hash the user"s password' });
            return;
          }
          // Create the user object
          const userObject = {
            firstName,
            lastName,
            phone,
            hashedPassword,
            tosAgreement,
          };

          // Store the user
          _data.create('users', phone, userObject, err => {
            if (!err) {
              callback(200);
            } else {
              console.log(err);
              callback(500, { Error: 'Could not create new user' });
            }
          });
        });
      } else callback(400, errorObj['400v2']);
    },

    /**
     * @name Users - get
     * @param {{}} data
     * @param {Function} callback
     * @requires {phone, token}
     * Optional data: none
     */

    get(data, callback) {
      const { queryStringObject, headers } = data;
      // Validate provided phone number
      const { phone } = extractedPayloadDataObj(queryStringObject);

      if (phone) {
        authenticate(headers, phone, callback, reqData => {
          _data.read('users', reqData, (err, data) => {
            if (!err) {
              // Remove hashedPassword from user object before responding with it
              delete data.hashedPassword;
              callback(200, data);
            } else callback(404);
          });
        });
      } else callback(400, errorObj['400v2']);
    },

    /**
     * @name Users - put
     * @param {{}} data
     * @param {Function} callback
     * @requires phone
     * Optional Data: firstName, lastName, password
     * At least one of the optional data should be specified
     */

    put(data, callback) {
      const { payload, headers } = data;

      // Check for required and optional fields
      const { phone, firstName, lastName, password } = extractedPayloadDataObj(payload);

      // Error if phone is invalid
      if (phone && (firstName || lastName || password)) {
        authenticate(headers, phone, callback, reqData => {
          _data.read('users', reqData, (err, userData) => {
            if (!err) {
              // Update necessary fields

              userData.firstName = firstName || userData.firstName;
              userData.lastName = lastName || userData.lastName;
              userData.hashedPassword = password
                ? helpers.hash(password)
                : helpers.hash(userData.hashedPassword);

              // Store the new updates
              _data.update('users', phone, userData, err => {
                if (!err) {
                  callback(200);
                } else {
                  console.log(err);
                  callback(500, { Error: 'Could not update the user' });
                }
              });
            } else callback(400, { Error: 'This specified user does not exist' });
          });
        });
      } else callback(400, errorObj['400v2']);
    },

    /**
     * Users - delete
     * @param {{}} data
     * @param {Function} callback
     * @requires phone
     * Optional data: none
     */

    delete(data, callback) {
      const { queryStringObject, headers } = data;

      // Validate provided phone number
      const { phone } = extractedPayloadDataObj(queryStringObject);

      if (phone) {
        authenticate(headers, phone, callback, () => {
          // Lookup User
          _data.read('users', phone, (err, userData) => {
            if (!err) {
              _data.delete('users', phone, err => {
                if (!err) {
                  // Delete each of the checks associated with the user
                  const { checks } = extractedPayloadDataObj(userData);
                  let errorCount = 0;

                  if (checks.length > 0) {
                    for (let i = 0; i < checks.length; i++) {
                      const checkId = checks[i];
                      _data.delete('checks', checkId, err => {
                        if (err) {
                          errorCount++;
                        }

                        if (i === checks.length - 1 && errorCount === 0) {
                          callback(200);
                        } else if (i === checks.length - 1) {
                          callback(500, {
                            Error: `Error encountered while attempting to delete ${errorCount} of your checks`,
                          });
                        }
                      });
                    }
                  } else callback(200);
                } else {
                  callback(500, {
                    Error: 'Could not delete the specified user',
                  });
                }
              });
            } else {
              callback(400, {
                Error: 'Could not find the specified user',
              });
            }
          });
        });
      } else callback(400, errorObj['400v2']);
    },
  },

  // Tokens
  tokens(data, callback) {
    generalHandler('tokens')(data, callback);
  },

  // Container for all the tokens methods

  _tokens: {
    /**
     * @name Tokens - post
     * @param {{}} data
     * @param {Function} callback
     * @requires {phone, password}
     * Optional data: none
     */

    post(data, callback) {
      const { payload } = data;
      const { phone, password } = extractedPayloadDataObj(payload);

      if (phone && password) {
        // Lookup the user who matches that phone number
        _data.read('users', phone, (err, userData) => {
          if (!err) {
            // Hash the sent password and compare it to the password stored in the user object
            const hashedPassword = helpers.hash(password);

            if (hashedPassword === userData.hashedPassword) {
              // If valid create a new token with a random name. Set expiration date 1 hour later
              const tokenId = helpers.createRandomString(20);
              const expires = Date.now() + 1000 * 3600;

              const tokenObject = {
                phone,
                id: tokenId,
                expires,
              };

              // Store the token
              _data.create('tokens', tokenId, tokenObject, err => {
                if (!err) {
                  callback(200, tokenObject);
                } else callback(500, { Error: 'Could not create new token' });
              });
            } else
              callback(400, {
                Error: "Password did not match the specified user's stored password",
              });
          } else callback(400, { Error: 'Could not find specified user' });
        });
      } else callback(400, errorObj['400v2']);
    },

    /**
     * @name Tokens - get
     * @param {{}} data
     * @param {Function} callback
     * @requires {id}
     *  Optional data: none;
     */

    get(data, callback) {
      // Validate Id
      const { queryStringObject } = data;

      // Validate provided user Id
      const { id } = extractedPayloadDataObj(queryStringObject);

      if (id) {
        // Lookup User
        _data.read('tokens', id, (err, tokenData) => {
          if (!err) {
            callback(200, tokenData);
          } else callback(404);
        });
      } else callback(400, errorObj['400v2']);
    },

    /**
     * @name Tokens - put
     * @param {{}} data
     * @param {Function} callback
     * @requires {Id, extend}
     * Optional data: none
     */

    put(data, callback) {
      const { payload } = data;
      const { id } = extractedPayloadDataObj(payload);

      const extend =
        !!payload?.extend && validateType(payload.extend, 'boolean') ? payload.extend : false;

      if (id && extend) {
        // Lookup the token
        _data.read('tokens', id, (err, tokenData) => {
          if (!err) {
            // Check if token has expired
            if (tokenData.expires > Date.now()) {
              // Increment expiration date by an hour

              tokenData.expires = Date.now() + 1000 * 3600;

              // Store new updates
              _data.update('tokens', id, tokenData, err => {
                if (!err) {
                  callback(200);
                } else callback(500, { Error: "Could not update token's expiration" });
              });
            } else callback(400, { Error: 'token has expired; therefore cannot be extended' });
          } else callback(400, { Error: 'Specified token does not exist' });
        });
      }
    },

    /**
     * @name Tokens - delete
     * @param {{}} data
     * @param {Function} callback
     * @requires {id}
     * Optional data: none
     */

    delete(data, callback) {
      const { queryStringObject } = data;
      // Validate Id
      const { id } = extractedPayloadDataObj(queryStringObject);

      if (id) {
        // Lookup User
        _data.read('tokens', id, err => {
          if (!err) {
            _data.delete('tokens', id, err => {
              if (!err) {
                callback(200);
              } else callback(500, { Error: 'Could not delete the specified token' });
            });
          } else callback(400, { Error: 'Could not find the specified token' });
        });
      } else callback(400, errorObj['400v2']);
    },

    // Verify if a given Id id currently valid for a given user

    verifyToken(Id, phone, callback) {
      // Lookup token
      _data.read('tokens', Id, (err, tokenData) => {
        if (!err) {
          // Check if token is for given user and has not expired
          if (tokenData.phone === phone && tokenData.expires > Date.now()) {
            callback(true);
          } else callback(false);
        } else callback(false);
      });
    },
  },

  // Checks
  checks(data, callback) {
    generalHandler('checks')(data, callback);
  },

  //  Container for all the checks methods
  _checks: {
    /**
     * @name Checks - post
     * @param {{}} data
     * @param {Function} callback
     * @requires {protocol, url, method, successCodes, timeoutSeconds}
     * Optional data: none
     */

    post(data, callback) {
      const { payload, headers } = data;
      // Validate inputs
      const { protocol, url, method, successCodes, timeoutSeconds } = extractedPayloadDataObj(
        payload
      );

      if (protocol && url && method && successCodes && timeoutSeconds) {
        // Get the token from the headers
        const token = validateType(headers.token, 'string') ? headers.token : false;

        // Lookup the user by reading the token
        _data.read('tokens', token, (err, tokenData) => {
          if (!err) {
            const userPhone = tokenData.phone;

            // Lookup User Data
            _data.read('users', userPhone, (err, userData) => {
              if (!err) {
                const { checks } = extractedPayloadDataObj(userData);

                // Verify that the user has less then the number of max checks
                if (checks.length < config.maxChecks) {
                  // Create a random Id for the checks
                  const checkId = helpers.createRandomString(20);

                  // Create the check object, and include the user's phone
                  const checkObject = {
                    Id: checkId,
                    userPhone,
                    protocol,
                    url,
                    method,
                    successCodes,
                    timeoutSeconds,
                  };

                  // Save the object
                  _data.create('checks', checkId, checkObject, err => {
                    if (err) {
                      callback(500, { Error: 'Could not create the new check' });
                      return;
                    }
                    // Add checkId to the user's object
                    userData.checks = checks;
                    userData.checks.push(checkId);

                    // Save the new user data
                    _data.update('users', userPhone, userData, err => {
                      if (!err) {
                        // Return the data about the new check
                        callback(200, checkObject);
                      } else {
                        callback(500, { Error: 'Could not update the user with the new checks' });
                      }
                    });
                  });
                } else
                  callback(400, { Error: `Maximum number of checks reached ${config.maxChecks}` });
              } else callback(403);
            });
          } else callback(403);
        });
      } else {
        callback(400, { Error: 'Missing required inputs, or inputs are invalid' });
      }
    },

    /**
     * @name Checks - get
     * @param {{}} data
     * @param {Function} callback
     * @requires id
     * Optional data: none
     */

    get(data, callback) {
      const { queryStringObject, headers } = data;
      // Validate provided phone number
      const { id } = extractedPayloadDataObj(queryStringObject);

      if (id) {
        // Lookup the check
        _data.read('checks', id, (err, checkData) => {
          if (!err) {
            authenticate(headers, checkData.userPhone, callback, () => {
              // Return the check data
              callback(200, checkData);
            });
          } else callback(404);
        });
      } else callback(400, errorObj['400v2']);
    },

    /**
     * @name Checks - put
     * @param {{}} data
     * @param {Function} callback
     * @requires id
     * Optional data: protocol, url, method, successCodes, timeoutSeconds
     * One of the optional data must be set
     */

    put(data, callback) {
      const { payload, headers } = data;
      // Check for required
      const dataObject = extractedPayloadDataObj(payload);
      const { id } = dataObject;

      // Validate id
      if (id) {
        // Check to make sure one or more optional fields has been set
        if (Object.keys(dataObject).some(key => !!dataObject[key] === true)) {
          // Lookup the check
          _data.read('checks', id, (err, checkData) => {
            if (!err) {
              authenticate(headers, checkData.userPhone, callback, () => {
                // Update the check where necessary
                Object.keys(dataObject).forEach(key =>
                  key ? (checkData[key] = dataObject[key]) : void 0
                );

                // Store the updates
                _data.update('checks', id, checkData, err => {
                  if (!err) {
                    callback(200);
                  } else callback(500, { Error: 'Could not update check' });
                });
              });
            } else callback(400, { Error: 'Check ID did not exist' });
          });
        } else callback(400, errorObj['400v2']);
      } else callback(400, errorObj['400v2']);
    },

    /**
     * @name Checks - delete
     * @param {{}} data
     * @param {Function} callback
     * @requires id
     * Optional data: none
     */

    delete(data, callback) {
      const { queryStringObject, headers } = data;

      // Validate provided phone number
      const { id } = extractedPayloadDataObj(queryStringObject);

      if (id) {
        // Lookup the check
        _data.read('checks', id, (err, checkData) => {
          if (!err) {
            authenticate(headers, checkData.userPhone, callback, reqData => {
              // Delete the check data
              _data.delete('checks', id, err => {
                if (!err) {
                  // Lookup User
                  _data.read('users', reqData, (err, userData) => {
                    if (!err) {
                      const { checks } = extractedPayloadDataObj(userData);

                      // Remove the deleted check from the list;
                      const checkIndex = checks.indexOf(id);
                      if (checkIndex !== -1) {
                        checks.splice(checkIndex, 1);
                        // Re-save the users data
                        _data.update('users', reqData, userData, err => {
                          if (!err) {
                            callback(200);
                          } else {
                            callback(500, {
                              Error: 'Could not update the specified user',
                            });
                          }
                        });
                      } else {
                        callback(500, { Error: "Could not find the check on user's object" });
                      }
                    } else {
                      callback(500, {
                        Error:
                          "Could not find the specified user, so could not remove check from user's list",
                      });
                    }
                  });
                } else callback(500, { Error: 'Could not delete check data' });
              });
            });
          } else callback(400, { Error: "Specified check ID doesn't exist" });
        });
      } else callback(400, errorObj['400v2']);
    },
  },
};

// Export the module
module.exports = handlers;

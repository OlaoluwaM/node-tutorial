// Create and export configuration variables

// Container for all tht env
const environments = {
  // Staging (default) environment
  staging: {
    httpPort: 3000,
    httpsPort: 3001,
    envName: 'staging',
    hashingSecret: 'thisIsASecret',
    maxChecks: 5,
    twilio: {
      accountSid: 'ACb32d411ad7fe886aac54c665d25e5c5d',
      authToken: '9455e3eb3109edc12e3d8c92768f7a67',
      fromPhone: '+15005550006',
    },
  },

  // Production environment
  production: {
    httpPort: 5000,
    httpsPort: 5001,
    envName: 'production',
    hashingSecret: 'thisIsAlsoASecret',
    maxChecks: 5,
    twilio: {
      accountSid: '',
      authToken: '',
      fromPhone: '',
    },
  },
};

// Determine which env was passed as a CLI argument
const currEnv = typeof process.env.NODE_ENV === 'string' ? process.env.NODE_ENV.toLowerCase() : '';

/*
 Check that the current environment is available in the environments object above, otherwise use staging environment
 */
const envToExport = environments[currEnv] ?? environments.staging;

// Export the module
module.exports = envToExport;

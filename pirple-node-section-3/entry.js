// API Primary File

// Dependencies
const server = require('./lib/server');
const workers = require('./lib/workers');

// Declare the app
const app = {
  // Init function
  init() {
    // Start the server
    server.init();

    // Start the workers
    workers.init();
  },
};

// Execute
app.init();

// Export the app
module.exports = app;

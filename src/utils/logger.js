const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../../logs/session-actions.log');

function logSessionAction(action, details) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    ...details
  };
  fs.appendFile(logFile, JSON.stringify(entry) + '\n', err => {
    if (err) console.error('Failed to write session log:', err);
  });
}

module.exports = { logSessionAction };
// Node.js script to generate production config.js
const fs = require('fs');
const path = require('path');

// Log environment information for debugging
console.log('Building with Node.js version:', process.version);
console.log('Environment variables available:', Object.keys(process.env).filter(key => !key.includes('SECRET')));

// Create the config object with environment variables
const config = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  // Add any other variables you need from Netlify
};

// Ensure the js directory exists
const configDir = './js';
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Write the config to a file
fs.writeFileSync(
  path.join(configDir, 'configProduction.js'), 
  `// Auto-generated config file - DO NOT EDIT
window.appConfig = ${JSON.stringify(config, null, 2)};`
);

console.log('Config file generated successfully at:', path.join(configDir, 'config.js'));
console.log('Config contents (masked):', {
  ...config,
  OPENROUTER_API_KEY: config.OPENROUTER_API_KEY ? '****' + config.OPENROUTER_API_KEY.slice(-4) : 'not set'
}); 
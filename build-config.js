// Node.js script to generate production config.js
const fs = require('fs');
const path = require('path');

// Simple obfuscation function
function obfuscate(str) {
  return Buffer.from(str).toString('base64');
}

// Log environment information for debugging
console.log('Building with Node.js version:', process.version);
console.log('Environment variables available:', Object.keys(process.env).filter(key => !key.includes('SECRET')));

// Create the config object with environment variables
const apiKey = process.env.OPENROUTER_API_KEY || '';
const config = {
  // Store the key obfuscated
  OPENROUTER_API_KEY_B64: obfuscate(apiKey),
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
window.appConfig = ${JSON.stringify(config, null, 2)};
// Function to deobfuscate the API key
window.getApiKey = function() {
  if (!window.appConfig.OPENROUTER_API_KEY_B64) return '';
  return atob(window.appConfig.OPENROUTER_API_KEY_B64);
};`
);

console.log('Config file generated successfully at:', path.join(configDir, 'configProduction.js'));
console.log('Config contents (masked):', {
  ...config,
  OPENROUTER_API_KEY_B64: config.OPENROUTER_API_KEY_B64 ? '****' : 'not set'
}); 
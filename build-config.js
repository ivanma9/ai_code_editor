// Node.js script to generate production config.js
const fs = require('fs');
const path = require('path');

// Simple obfuscation function
function obfuscate(str) {
  return Buffer.from(str).toString('base64');
}

// Basic .env file parser for local development
function parseEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.log('.env file not found, using process.env only');
    return {};
  }
  
  console.log('Found .env file, parsing...');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  // Parse each line in the .env file
  envContent.split('\n').forEach(line => {
    // Skip empty lines and comments
    if (!line || line.startsWith('#')) return;
    
    // Extract key and value
    const match = line.match(/^([^=]+)=["']?(.+?)["']?$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      envVars[key] = value;
    }
  });
  
  return envVars;
}

// Combine environment variables from .env file and process.env
const envVars = parseEnvFile();
const combinedEnv = { ...envVars, ...process.env };

// More detailed logging for debugging
console.log('Building with Node.js version:', process.version);
console.log('Environment variables available:', Object.keys(combinedEnv).filter(key => !key.includes('SECRET')));
console.log('Looking for OPENROUTER_API_KEY...');
console.log('OPENROUTER_API_KEY exists:', combinedEnv.OPENROUTER_API_KEY ? 'Yes' : 'No');
console.log('OPENROUTER_API_KEY starts with:', combinedEnv.OPENROUTER_API_KEY ? combinedEnv.OPENROUTER_API_KEY.substring(0, 3) + '...' : 'N/A');

// Create the config object with environment variables
const apiKey = combinedEnv.OPENROUTER_API_KEY || '';
console.log('API key length:', apiKey.length);
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
  path.join(configDir, 'config.js'), 
  `// Auto-generated config file - DO NOT EDIT
window.appConfig = ${JSON.stringify(config, null, 2)};
// Function to deobfuscate the API key
window.getApiKey = function() {
  if (!window.appConfig.OPENROUTER_API_KEY_B64) return '';
  return atob(window.appConfig.OPENROUTER_API_KEY_B64);
};`
);

console.log('Config file generated successfully at:', path.join(configDir, 'config.js'));
console.log('Config contents (masked):', {
  ...config,
  OPENROUTER_API_KEY_B64: config.OPENROUTER_API_KEY_B64 ? '****' : 'not set'
}); 
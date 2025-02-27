// Auto-generated config file - DO NOT EDIT
window.appConfig = {
  "OPENROUTER_API_KEY_B64": "c2stb3ItdjEtZmQzMjdlN2RkOTM0ZDc1MTIyZGVmZjRjNjg1YzAxOTJhODE3MTBmM2Y3NzE2OTRiZWM3ZTg0ZjlmMWE4ODI4Nw=="
};
// Function to deobfuscate the API key
window.getApiKey = function() {
  if (!window.appConfig.OPENROUTER_API_KEY_B64) return '';
  return atob(window.appConfig.OPENROUTER_API_KEY_B64);
};
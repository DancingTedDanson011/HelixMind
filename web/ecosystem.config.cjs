const { readFileSync } = require('fs');
const { resolve } = require('path');

// Parse .env file into key-value pairs
function loadEnv() {
  try {
    const envPath = resolve(__dirname, '.env');
    const content = readFileSync(envPath, 'utf8');
    const env = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
    return env;
  } catch {
    return {};
  }
}

module.exports = {
  apps: [{
    name: 'helixmind-web',
    script: 'server.ts',
    interpreter: 'node',
    interpreter_args: '--import tsx',
    cwd: __dirname,
    env: loadEnv(),
  }],
};

/**
 * Chrome/Chromium executable finder — cross-platform.
 *
 * Searches known installation paths per platform.
 * Does NOT download Chrome — uses whatever is already installed.
 */

import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { platform } from 'node:os';

/** Known Chrome paths per platform */
const CHROME_PATHS: Record<string, string[]> = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.PROGRAMFILES ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
    // Edge as fallback (Chromium-based)
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    `${process.env.HOME ?? ''}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
  ],
};

/**
 * Find a Chrome/Chromium executable on the system.
 * Returns the path if found, null otherwise.
 */
export function findChrome(): string | null {
  const os = platform();
  const candidates = CHROME_PATHS[os] ?? [];

  // Check known paths
  for (const path of candidates) {
    if (path && existsSync(path)) {
      return path;
    }
  }

  // On Linux, try `which`
  if (os === 'linux') {
    for (const bin of ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium']) {
      try {
        const result = execSync(`which ${bin}`, { encoding: 'utf-8', timeout: 3000 }).trim();
        if (result && existsSync(result)) return result;
      } catch {
        // not found
      }
    }
  }

  // On Windows, try `where` for Edge
  if (os === 'win32') {
    try {
      const result = execSync('where msedge', { encoding: 'utf-8', timeout: 3000 }).trim().split('\n')[0];
      if (result && existsSync(result)) return result;
    } catch {
      // not found
    }
  }

  return null;
}

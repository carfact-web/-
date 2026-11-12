/* eslint-disable @typescript-eslint/no-require-imports -- Resolve the installed browser for local checks. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
function browserPath() {
 const candidates = process.platform === 'win32'
  ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
    .filter(Boolean).flatMap(root => [path.join(root, 'Google/Chrome/Application/chrome.exe'), path.join(root, 'Microsoft/Edge/Application/msedge.exe')])
  : ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
 const found = candidates.find(candidate => fs.existsSync(candidate));
 if (!found) throw Error('Install Chrome or Edge before running local browser checks.');
 return found;
}
module.exports = { browserPath };

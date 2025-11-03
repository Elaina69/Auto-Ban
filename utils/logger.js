import fs from 'fs';
import path from 'path';

// Create logs folder if not exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

function getLogFilePath() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return path.join(logsDir, `${dd}-${mm}-${yyyy}.txt`);
}

function writeLog(type, ...args) {
    const timestamp = new Date().toLocaleTimeString();
    const logLine = `[${timestamp}] [${type}] ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
    fs.appendFile(getLogFilePath(), logLine, () => {});
}

// Hook console methods
const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;

console.log = (...args) => {
    writeLog('LOG', ...args);
    origLog(...args);
};
console.warn = (...args) => {
    writeLog('WARN', ...args);
    origWarn(...args);
};
console.error = (...args) => {
    writeLog('ERROR', ...args);
    origError(...args);
};
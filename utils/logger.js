import fs from 'fs';
import path from 'path';

export class Logger {
    constructor(logsDir = path.join(process.cwd(), 'logs')) {
        this.logsDir = logsDir;

        // Create logs folder if not exists
        if (!fs.existsSync(this.logsDir)) fs.mkdirSync(this.logsDir, { recursive: true });
        this.hookConsole();
    }

    getLogFilePath(date = new Date()) {
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();

        return path.join(this.logsDir, `${dd}-${mm}-${yyyy}.txt`);
    }

    write(type, ...args) {
        const ts = new Date().toLocaleTimeString();
        const line = `[${ts}] [${type}] ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
        const file = this.getLogFilePath();
        fs.appendFile(file, line, (err) => { if (err) process.stderr.write('Logger write error: ' + err.message + '\n'); });
    }

    hookConsole() {
        const origLog = console.log.bind(console);
        const origWarn = console.warn.bind(console);
        const origError = console.error.bind(console);

        console.log = (...args) => { this.write('LOG', ...args); origLog(...args); };
        console.warn = (...args) => { this.write('WARN', ...args); origWarn(...args); };
        console.error = (...args) => { this.write('ERROR', ...args); origError(...args); };
    }
}
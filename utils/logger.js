import fs from 'fs';
import path from 'path';
import { resolveBotInstance } from './runtimeInstance.js';

export class Logger {
    static hooked = false;
    static activeLogger = null;
    static originalConsole = null;

    constructor(logsDir = null) {
        this.botInstance = resolveBotInstance();
        this.logsDir = logsDir || path.join(process.cwd(), 'logs', `instance-${this.botInstance}`);

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
        const line = `[${ts}] [instance:${this.botInstance}] [${type}] ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
        const file = this.getLogFilePath();
        fs.appendFile(file, line, (err) => { if (err) process.stderr.write('Logger write error: ' + err.message + '\n'); });
    }

    hookConsole() {
        Logger.activeLogger = this;

        if (Logger.hooked) {
            return;
        }

        Logger.originalConsole = {
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console)
        };

        console.log = (...args) => {
            Logger.activeLogger?.write('LOG', ...args);
            Logger.originalConsole.log(...args);
        };
        console.warn = (...args) => {
            Logger.activeLogger?.write('WARN', ...args);
            Logger.originalConsole.warn(...args);
        };
        console.error = (...args) => {
            Logger.activeLogger?.write('ERROR', ...args);
            Logger.originalConsole.error(...args);
        };

        Logger.hooked = true;
    }
}

import fs from 'fs';
import path from 'path';
import { format } from './formatLang.js';

function isProcessRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } 
    catch (e) {
        return false;
    }
}

/**
 * Sets up a lock file for the bot process.
 * @param {string} botId - The ID of the bot.
 * @param {string} dir - The directory to store the lock file.
 * @param {object} lang - The language pack.
 */
function setupLockfile(botId, dir, lang) {
    const lockFilePath = path.join(dir, `${botId}.lock`);

    // Check if the lock file already exists
    if (fs.existsSync(lockFilePath)) {
        const oldPid = parseInt(fs.readFileSync(lockFilePath, "utf-8"), 10);

        // Check if the old process is still running
        if (isNaN(oldPid) || !isProcessRunning(oldPid)) {
            console.warn(format(lang.duplicatedLockFile, { oldPid }));
            fs.unlinkSync(lockFilePath);
        } 
        else {
            console.error(format(lang.lockFileInUse, { botId, oldPid }));
            process.exit(1);
        }
    }

    // Create new lock file
    fs.writeFileSync(lockFilePath, String(process.pid));

    // Cleanup lock file on exit
    process.on("exit", () => {
        if (fs.existsSync(lockFilePath)) {
            fs.unlinkSync(lockFilePath);
        }
    });
    process.on("SIGINT", () => process.exit());
    process.on("SIGTERM", () => process.exit());
}

export {
    setupLockfile
};
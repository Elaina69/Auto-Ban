import fs from 'fs';
import path from 'path';

function isProcessRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return false;
    }
}

function setupLockfile(botId, dir, format, lang) {
    const lockFilePath = path.join(dir, `${botId}.lock`);
    if (fs.existsSync(lockFilePath)) {
        const oldPid = parseInt(fs.readFileSync(lockFilePath, "utf-8"), 10);
        if (isNaN(oldPid) || !isProcessRunning(oldPid)) {
            console.warn(format(lang.duplicatedLockFile, { oldPid }));
            fs.unlinkSync(lockFilePath);
        } else {
            console.error(format(lang.lockFileInUse, { botId, oldPid }));
            process.exit(1);
        }
    }
    fs.writeFileSync(lockFilePath, String(process.pid));
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
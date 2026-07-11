import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildZipFromDirectory } from './zipUtils.js';
import {
    atomicWriteFileSync,
    ensureDirSync,
    formatTimestamp,
    recoverJsonFiles,
    sleepSync,
    withFileLockSync
} from './safeJsonStore.js';
import { getBotConfigFileName, resolveBotInstance } from './runtimeInstance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(ROOT_DIR, 'configs');
const BACKUP_DIR = path.join(ROOT_DIR, '_backup');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function configPath(fileName) {
    return path.join(CONFIG_DIR, fileName);
}

function isRuntimeTempFile(relativePath) {
    return relativePath.endsWith('.tmp') ||
        relativePath.endsWith('.lock') ||
        relativePath.includes('/.DS_Store');
}

class BackupManager {
    getManagedJsonConfigs() {
        const currentBotConfig = getBotConfigFileName(resolveBotInstance());
        const files = new Map([
            ['serverConfig.json', { defaultValue: {} }],
            ['bannedAccountsServers.json', { defaultValue: {} }],
            ['raidIncidents.json', { defaultValue: {} }],
            ['farmData.json', { defaultValue: {} }],
            ['farmServerConfig.json', { defaultValue: {} }],
            ['priceHistory.json', { defaultValue: {} }],
            [currentBotConfig, { allowDefault: false }]
        ]);

        if (fs.existsSync(CONFIG_DIR)) {
            for (const fileName of fs.readdirSync(CONFIG_DIR)) {
                if (/^botConfig\.\d+\.json$/.test(fileName)) {
                    files.set(fileName, { allowDefault: false });
                }
            }
        }

        return [...files.entries()].map(([fileName, options]) => ({
            filePath: configPath(fileName),
            ...options
        }));
    }

    recoverConfigs() {
        ensureDirSync(BACKUP_DIR);
        return recoverJsonFiles(this.getManagedJsonConfigs());
    }

    createBackup(reason = 'manual') {
        ensureDirSync(BACKUP_DIR);

        const lockPath = path.join(BACKUP_DIR, '.backup.lock');
        return withFileLockSync(lockPath, () => {
            const { buffer, fileCount } = buildZipFromDirectory(CONFIG_DIR, {
                rootName: 'configs',
                filter: (_fullPath, relativePath) => !isRuntimeTempFile(relativePath.replace(/\\/g, '/'))
            });

            if (fileCount === 0) {
                console.warn('[BACKUP] No config files found to back up.');
                return null;
            }

            let backupFile = path.join(BACKUP_DIR, `${formatTimestamp()}.zip`);
            while (fs.existsSync(backupFile)) {
                sleepSync(1000);
                backupFile = path.join(BACKUP_DIR, `${formatTimestamp()}.zip`);
            }

            atomicWriteFileSync(backupFile, buffer);
            console.log(`[BACKUP] Created ${backupFile} (${fileCount} files, reason: ${reason}).`);
            return backupFile;
        }, {
            timeoutMs: 5 * 60 * 1000,
            staleMs: 30 * 60 * 1000
        });
    }

    scheduleWeeklyBackups() {
        setInterval(() => {
            try {
                this.createBackup('weekly');
            } catch (err) {
                console.error('[BACKUP] Weekly backup failed:', err);
            }
        }, WEEK_MS);
    }
}

export const backupManager = new BackupManager();

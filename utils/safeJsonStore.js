import fs from 'fs';
import path from 'path';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { readZipEntry } from './zipUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT_DIR, '_backup');
const LAST_GOOD_DIR = path.join(BACKUP_DIR, '_last-good');
const CORRUPT_DIR = path.join(BACKUP_DIR, '_corrupt');
const LOCK_DIR = path.join(BACKUP_DIR, '_locks');
const KEY_DIR = path.join(BACKUP_DIR, '_keys');
const KEY_FILE = path.join(KEY_DIR, 'data-encryption-key');

const DEFAULT_LOCK_TIMEOUT_MS = 30_000;
const DEFAULT_LOCK_STALE_MS = 2 * 60 * 1000;
const LOCK_POLL_MS = 100;
const ENABLE_DIRECTORY_FSYNC = true;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_VERSION = 1;
const ENCRYPTED_JSON_MARKER = 'auto-ban-encrypted-json';
const ENCRYPTION_KEY_ENV = 'AUTO_BAN_DATA_KEY';

let cachedEncryptionKey = null;

export function createDataHmac(value, context = 'auto-ban') {
    const key = getEncryptionKey({ createIfMissing: true });
    return createHmac('sha256', key)
        .update(`${context}\0${String(value)}`, 'utf8')
        .digest('hex');
}

export class JsonEncryptionError extends Error {
    constructor(message, cause = null) {
        super(message);
        this.name = 'JsonEncryptionError';
        this.cause = cause;
    }
}

export class MissingEncryptionKeyError extends JsonEncryptionError {
    constructor(message) {
        super(message);
        this.name = 'MissingEncryptionKeyError';
    }
}

export function sleepSync(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function ensureDirSync(dir) {
    if (fs.existsSync(dir)) return;

    try {
        fs.mkdirSync(dir, { recursive: true });
        return;
    } catch (err) {
        if (!['ENOENT', 'EPERM'].includes(err.code)) {
            throw err;
        }
    }

    const parent = path.dirname(dir);
    if (parent && parent !== dir) {
        ensureDirSync(parent);
    }

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }
            return;
        } catch (err) {
            if (attempt === 2 || !['EEXIST', 'ENOENT', 'EPERM'].includes(err.code)) {
                throw err;
            }
            sleepSync(50);
        }
    }
}

export function formatTimestamp(date = new Date()) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}

function fsyncDirSync(dir) {
    if (!ENABLE_DIRECTORY_FSYNC) return;

    try {
        const fd = fs.openSync(dir, 'r');
        try {
            fs.fsyncSync(fd);
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        // Some platforms cannot fsync directories. Atomic rename still protects the file.
    }
}

function decodeKeyMaterial(keyText) {
    const trimmed = keyText.trim();

    if (!trimmed) {
        throw new MissingEncryptionKeyError(`${ENCRYPTION_KEY_ENV} is empty.`);
    }

    if (/^[0-9a-f]{64}$/i.test(trimmed)) {
        return Buffer.from(trimmed, 'hex');
    }

    try {
        const decoded = Buffer.from(trimmed, 'base64');
        if (decoded.length === 32) {
            return decoded;
        }
    } catch {}

    return createHash('sha256').update(trimmed, 'utf8').digest();
}

function getEncryptionKey(options = {}) {
    if (cachedEncryptionKey) return cachedEncryptionKey;

    const envKey = process.env[ENCRYPTION_KEY_ENV];
    if (envKey) {
        cachedEncryptionKey = decodeKeyMaterial(envKey);
        return cachedEncryptionKey;
    }

    if (fs.existsSync(KEY_FILE)) {
        const storedKey = fs.readFileSync(KEY_FILE, 'utf8');
        cachedEncryptionKey = decodeKeyMaterial(storedKey);
        return cachedEncryptionKey;
    }

    if (!options.createIfMissing) {
        throw new MissingEncryptionKeyError(
            `Missing encryption key. Set ${ENCRYPTION_KEY_ENV} or restore ${KEY_FILE}.`
        );
    }

    ensureDirSync(KEY_DIR);
    return withFileLockSync(path.join(KEY_DIR, 'data-encryption-key.lock'), () => {
        if (fs.existsSync(KEY_FILE)) {
            const storedKey = fs.readFileSync(KEY_FILE, 'utf8');
            cachedEncryptionKey = decodeKeyMaterial(storedKey);
            return cachedEncryptionKey;
        }

        cachedEncryptionKey = randomBytes(32);
        atomicWriteFileSync(KEY_FILE, `${cachedEncryptionKey.toString('base64')}\n`);

        try {
            fs.chmodSync(KEY_FILE, 0o600);
        } catch {}

        console.warn(`[CONFIG] Generated local data encryption key at ${KEY_FILE}. Back it up securely or set ${ENCRYPTION_KEY_ENV}.`);
        return cachedEncryptionKey;
    });
}

function isEncryptedJsonPayload(value) {
    return value &&
        typeof value === 'object' &&
        value._format === ENCRYPTED_JSON_MARKER &&
        value.version === ENCRYPTION_VERSION &&
        value.algorithm === ENCRYPTION_ALGORITHM;
}

function encryptJsonValue(value) {
    const key = getEncryptionKey({ createIfMissing: true });
    const iv = randomBytes(12);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        _format: ENCRYPTED_JSON_MARKER,
        version: ENCRYPTION_VERSION,
        algorithm: ENCRYPTION_ALGORITHM,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        data: ciphertext.toString('base64')
    };
}

function decryptJsonPayload(payload, filePath) {
    try {
        const key = getEncryptionKey({ createIfMissing: false });
        const iv = Buffer.from(payload.iv, 'base64');
        const authTag = Buffer.from(payload.authTag, 'base64');
        const data = Buffer.from(payload.data, 'base64');

        const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
        return JSON.parse(plaintext);
    } catch (err) {
        if (err instanceof JsonEncryptionError) throw err;
        throw new JsonEncryptionError(`Could not decrypt JSON file ${filePath}. Check ${ENCRYPTION_KEY_ENV}.`, err);
    }
}

export function atomicWriteFileSync(filePath, data) {
    ensureDirSync(path.dirname(filePath));

    const tmpFile = `${filePath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
    let fd;

    try {
        fd = fs.openSync(tmpFile, 'wx');
        fs.writeFileSync(fd, data);
        try {
            fs.fsyncSync(fd);
        } catch (err) {
            console.warn(`[CONFIG] File fsync failed for ${filePath}: ${err.message}`);
        }
        fs.closeSync(fd);
        fd = undefined;

        fs.renameSync(tmpFile, filePath);
        fsyncDirSync(path.dirname(filePath));
    } catch (err) {
        if (fd !== undefined) {
            try {
                fs.closeSync(fd);
            } catch {}
        }
        try {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        } catch {}
        throw err;
    }
}

function lockPathFor(filePath) {
    ensureDirSync(LOCK_DIR);
    const relative = path.relative(ROOT_DIR, filePath).replace(/[\\/:*?"<>|]/g, '_');
    return path.join(LOCK_DIR, `${relative}.lock`);
}

function readLockInfo(lockPath) {
    try {
        return fs.readFileSync(lockPath, 'utf8');
    } catch {
        return '';
    }
}

export function withFileLockSync(lockPath, callback, options = {}) {
    ensureDirSync(path.dirname(lockPath));

    const timeoutMs = options.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
    const staleMs = options.staleMs ?? DEFAULT_LOCK_STALE_MS;
    const startedAt = Date.now();
    let fd;

    while (true) {
        try {
            fd = fs.openSync(lockPath, 'wx');
            fs.writeFileSync(fd, JSON.stringify({
                pid: process.pid,
                createdAt: new Date().toISOString()
            }));
            fs.closeSync(fd);
            fd = undefined;
            break;
        } catch (err) {
            if (fd !== undefined) {
                try {
                    fs.closeSync(fd);
                } catch {}
                fd = undefined;
            }

            if (err.code !== 'EEXIST') throw err;

            let stat;
            try {
                stat = fs.statSync(lockPath);
            } catch (statErr) {
                if (statErr.code === 'ENOENT') continue;
                throw statErr;
            }
            if (Date.now() - stat.mtimeMs > staleMs) {
                console.warn(`[CONFIG] Removing stale lock ${lockPath}: ${readLockInfo(lockPath)}`);
                try {
                    fs.unlinkSync(lockPath);
                } catch (unlinkErr) {
                    if (unlinkErr.code !== 'ENOENT') throw unlinkErr;
                }
                continue;
            }

            if (Date.now() - startedAt > timeoutMs) {
                throw new Error(`Timed out waiting for config lock: ${lockPath}`);
            }

            sleepSync(LOCK_POLL_MS);
        }
    }

    try {
        return callback();
    } finally {
        try {
            if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
        } catch (err) {
            console.warn(`[CONFIG] Could not remove lock ${lockPath}: ${err.message}`);
        }
    }
}

function getLastGoodPath(filePath) {
    const relative = path.relative(ROOT_DIR, filePath).replace(/[\\/:*?"<>|]/g, '_');
    return path.join(LAST_GOOD_DIR, `${relative}.last-good`);
}

function getZipEntryName(filePath) {
    return path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
}

function cloneDefaultValue(defaultValue) {
    const value = typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function parseJsonText(filePath, text) {
    if (!text.trim()) {
        throw new Error(`Empty JSON file: ${filePath}`);
    }

    const parsed = JSON.parse(text);

    if (isEncryptedJsonPayload(parsed)) {
        return {
            data: decryptJsonPayload(parsed, filePath),
            encrypted: true
        };
    }

    return {
        data: parsed,
        encrypted: false
    };
}

function serializeJsonText(value) {
    return `${JSON.stringify(encryptJsonValue(value), null, 4)}\n`;
}

function readJsonFileMetaUnlocked(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    return parseJsonText(filePath, text);
}

function readJsonFileUnlocked(filePath) {
    return readJsonFileMetaUnlocked(filePath).data;
}

function saveLastGoodJsonFile(filePath, jsonText) {
    try {
        ensureDirSync(LAST_GOOD_DIR);
        atomicWriteFileSync(getLastGoodPath(filePath), jsonText);
    } catch (err) {
        console.warn(`[CONFIG] Could not update last-good copy for ${filePath}: ${err.message}`);
    }
}

function writeJsonFileUnlocked(filePath, value) {
    const jsonText = serializeJsonText(value);
    atomicWriteFileSync(filePath, jsonText);
    saveLastGoodJsonFile(filePath, jsonText);
    return value;
}

function quarantineBadFile(filePath) {
    if (!fs.existsSync(filePath)) return null;

    ensureDirSync(CORRUPT_DIR);
    const baseName = path.basename(filePath);
    let destination = path.join(CORRUPT_DIR, `${formatTimestamp()}_${baseName}`);

    while (fs.existsSync(destination)) {
        destination = path.join(CORRUPT_DIR, `${formatTimestamp()}_${randomBytes(3).toString('hex')}_${baseName}`);
    }

    try {
        fs.renameSync(filePath, destination);
    } catch {
        fs.copyFileSync(filePath, destination);
        fs.unlinkSync(filePath);
    }

    return destination;
}

function getBackupZipFiles() {
    if (!fs.existsSync(BACKUP_DIR)) return [];

    return fs.readdirSync(BACKUP_DIR)
        .filter(file => file.endsWith('.zip'))
        .sort()
        .reverse()
        .map(file => path.join(BACKUP_DIR, file));
}

function restoreFromLastGood(filePath) {
    const lastGoodPath = getLastGoodPath(filePath);
    if (!fs.existsSync(lastGoodPath)) return null;

    const text = fs.readFileSync(lastGoodPath, 'utf8');
    const { data } = parseJsonText(lastGoodPath, text);
    writeJsonFileUnlocked(filePath, data);

    console.warn(`[CONFIG] Restored ${path.basename(filePath)} from last-good copy.`);
    return data;
}

function restoreFromBackupZip(filePath) {
    const entryName = getZipEntryName(filePath);

    for (const zipFile of getBackupZipFiles()) {
        try {
            const entry = readZipEntry(zipFile, entryName);
            if (!entry) continue;

            const text = entry.toString('utf8');
            const { data } = parseJsonText(`${zipFile}:${entryName}`, text);
            writeJsonFileUnlocked(filePath, data);

            console.warn(`[CONFIG] Restored ${path.basename(filePath)} from backup ${path.basename(zipFile)}.`);
            return data;
        } catch (err) {
            if (err instanceof JsonEncryptionError) {
                throw err;
            }
            console.warn(`[CONFIG] Could not restore ${path.basename(filePath)} from ${path.basename(zipFile)}: ${err.message}`);
        }
    }

    return null;
}

function recoverJsonFileUnlocked(filePath, options = {}, reason = null) {
    if (fs.existsSync(filePath)) {
        try {
            return readJsonFileUnlocked(filePath);
        } catch (err) {
            if (err instanceof JsonEncryptionError) {
                throw err;
            }

            const quarantinedPath = quarantineBadFile(filePath);
            if (quarantinedPath) {
                console.warn(`[CONFIG] Moved invalid ${path.basename(filePath)} to ${quarantinedPath}.`);
            }
        }
    }

    const fromLastGood = restoreFromLastGood(filePath);
    if (fromLastGood) return fromLastGood;

    const fromBackup = restoreFromBackupZip(filePath);
    if (fromBackup) return fromBackup;

    const allowDefault = options.allowDefault !== false;
    if (allowDefault) {
        const defaultValue = cloneDefaultValue(options.defaultValue ?? {});
        console.warn(`[CONFIG] Recreated ${path.basename(filePath)} with default data${reason ? ` after: ${reason.message}` : ''}.`);
        return writeJsonFileUnlocked(filePath, defaultValue);
    }

    throw new Error(`Could not recover required JSON config ${filePath}${reason ? `: ${reason.message}` : ''}`);
}

export function readJsonFile(filePath, options = {}) {
    try {
        const meta = readJsonFileMetaUnlocked(filePath);

        if (meta.encrypted) {
            return meta.data;
        }

        return withFileLockSync(lockPathFor(filePath), () => {
            const lockedMeta = readJsonFileMetaUnlocked(filePath);
            if (!lockedMeta.encrypted) {
                writeJsonFileUnlocked(filePath, lockedMeta.data);
                console.warn(`[CONFIG] Migrated ${path.basename(filePath)} to encrypted storage.`);
            }
            return lockedMeta.data;
        }, options.lockOptions);
    } catch (err) {
        return withFileLockSync(lockPathFor(filePath), () => {
            try {
                const meta = readJsonFileMetaUnlocked(filePath);
                if (!meta.encrypted) {
                    writeJsonFileUnlocked(filePath, meta.data);
                    console.warn(`[CONFIG] Migrated ${path.basename(filePath)} to encrypted storage.`);
                }
                return meta.data;
            } catch (lockedErr) {
                return recoverJsonFileUnlocked(filePath, options, lockedErr);
            }
        }, options.lockOptions);
    }
}

export function writeJsonFile(filePath, value, options = {}) {
    return withFileLockSync(lockPathFor(filePath), () => {
        return writeJsonFileUnlocked(filePath, value);
    }, options.lockOptions);
}

export function updateJsonFile(filePath, defaultValue, updater, options = {}) {
    return withFileLockSync(lockPathFor(filePath), () => {
        let data;
        try {
            data = readJsonFileUnlocked(filePath);
        } catch (err) {
            data = recoverJsonFileUnlocked(filePath, {
                ...options,
                defaultValue
            }, err);
        }

        const result = updater(data);
        writeJsonFileUnlocked(filePath, data);
        return result === undefined ? data : result;
    }, options.lockOptions);
}

export function recoverJsonFiles(files) {
    const results = [];

    for (const file of files) {
        try {
            const data = readJsonFile(file.filePath, file);
            results.push({ filePath: file.filePath, ok: true, data });
        } catch (err) {
            console.error(`[CONFIG] Recovery failed for ${file.filePath}: ${err.message}`);
            results.push({ filePath: file.filePath, ok: false, error: err });
        }
    }

    return results;
}

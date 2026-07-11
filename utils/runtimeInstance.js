const DEFAULT_BOT_INSTANCE = '1';
const INSTANCE_ID_PATTERN = /^[1-9][0-9]*$/;

function normalizeInstanceId(value, variableName) {
    const instance = String(value || '').trim();

    if (!INSTANCE_ID_PATTERN.test(instance)) {
        throw new Error(`${variableName} must be a positive integer, got '${value}'.`);
    }

    return instance;
}

export function resolveBotInstance(env = process.env) {
    const rawInstance = env.BOT_INSTANCE;

    if (!rawInstance || !String(rawInstance).trim()) {
        return DEFAULT_BOT_INSTANCE;
    }

    return normalizeInstanceId(rawInstance, 'BOT_INSTANCE');
}

export function getBotConfigFileName(instance = resolveBotInstance()) {
    return `botConfig.${normalizeInstanceId(instance, 'BOT_INSTANCE')}.json`;
}

export function getBackupOwner(env = process.env) {
    const rawOwner = env.AUTO_BAN_BACKUP_OWNER;

    if (!rawOwner || !String(rawOwner).trim()) {
        return null;
    }

    return normalizeInstanceId(rawOwner, 'AUTO_BAN_BACKUP_OWNER');
}

export function shouldRunBackupsForInstance(env = process.env) {
    const backupOwner = getBackupOwner(env);

    if (!backupOwner) {
        return true;
    }

    return resolveBotInstance(env) === backupOwner;
}

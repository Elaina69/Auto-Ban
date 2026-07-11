import { createDataHmac } from '../utils/safeJsonStore.js';

// Process-local moderation fingerprints. Raw message content is never stored here.
const messageHistory = new Map();
const cleanupTimers = new Map();

function normalizeContent(content) {
    return String(content || '')
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

export function createContentFingerprint(content) {
    const normalized = normalizeContent(content);
    if (!normalized) return null;
    return createDataHmac(normalized, 'moderation-message-fingerprint');
}

function scheduleCleanup(key, windowMs) {
    const existing = cleanupTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
        const now = Date.now();
        const recent = (messageHistory.get(key) || [])
            .filter(entry => now - entry.timestamp <= windowMs);

        if (recent.length > 0) {
            messageHistory.set(key, recent);
            scheduleCleanup(key, windowMs);
        } else {
            messageHistory.delete(key);
            cleanupTimers.delete(key);
        }
    }, windowMs + 50);

    timer.unref?.();
    cleanupTimers.set(key, timer);
}

export class SpamDetector {
    constructor(botConfig = {}) {
        this.updateConfig(botConfig);
    }

    updateConfig(botConfig = {}) {
        this.spamWindowMs = botConfig.spamWindowMs ?? 60_000;
        this.channelSpamThreshold = botConfig.channelSpamThreshold ?? 3;
    }

    /**
     * Checks if a message send in banned channel.
     * @param {import('discord.js').Message} message - The message object.
     * @param {object} serverConfig - The server configuration.
     * @returns {boolean} - True if the message send in banned channel, false otherwise.
     */
    isSpamInBannedChannel(message, serverConfig) {
        // Ignore messages from bots
        if (message.author.bot || !message.guild) return false;

        const guildId = message.guild.id;
        const settings = serverConfig[guildId];

        // If no settings found for the guild, don't ban
        if (!settings) return false;

        return message.channel.id === settings.bannedChannelId;
    }

    /**
     * Detects multi-channel spam.
     * @param {import('discord.js').Message} message
     * @returns {object|null} - { isSpam: boolean, warning: boolean, channels: array } or null if not spam
     */
    detectMultiChannelSpam(message) {
        const now = Date.now();
        const key = `${message.guild.id}:${message.author.id}`;
        const fingerprint = createContentFingerprint(message.content);

        if (!fingerprint) return null;

        if (!messageHistory.has(key)) {
            messageHistory.set(key, []);
        }

        const history = messageHistory.get(key);

        history.push({
            channelId: message.channel.id,
            fingerprint,
            timestamp: now
        });

        const recent = history.filter(msg => now - msg.timestamp <= this.spamWindowMs);
        messageHistory.set(key, recent);
        scheduleCleanup(key, this.spamWindowMs);

        // Check multi-channel spam (spam same content in >= threshold channels)
        const distinctChannels = new Set(
            recent
                .filter(msg => msg.fingerprint === fingerprint)
                .map(msg => msg.channelId)
        );

        const isSpam = distinctChannels.size >= this.channelSpamThreshold;
        const warning = distinctChannels.size === this.channelSpamThreshold - 1;

        // For debugging ONLY. DO NOT ENABLE IN PRODUCTION
        // console.log(`User ${userId} sent "${content}" in ${distinctChannels.size} distinct channels. Threshold: ${this.channelSpamThreshold}, Warning: ${warning}, Spam: ${isSpam}`);

        if (isSpam) {
            messageHistory.delete(key);
            const cleanupTimer = cleanupTimers.get(key);
            if (cleanupTimer) clearTimeout(cleanupTimer);
            cleanupTimers.delete(key);
            return { isSpam: true, warning: false, channels: Array.from(distinctChannels), fingerprint };
        } else if (warning) {
            return { isSpam: false, warning: true, channels: Array.from(distinctChannels), fingerprint };
        }

        return null;
    }
}

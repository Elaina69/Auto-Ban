// Persistent memory to store recent messages for multi-channel spam detection across all instances
const messageHistory = new Map();

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
        const userId = message.author.id;
        const content = message.content?.trim?.() || '';

        if (!content) return null;

        if (!messageHistory.has(userId)) {
            messageHistory.set(userId, []);
        }

        const history = messageHistory.get(userId);

        history.push({
            channelId: message.channel.id,
            content,
            timestamp: now
        });

        const recent = history.filter(msg => now - msg.timestamp <= this.spamWindowMs);
        messageHistory.set(userId, recent);

        // Check multi-channel spam (spam same content in >= threshold channels)
        const distinctChannels = new Set(
            recent
                .filter(msg => msg.content === content)
                .map(msg => msg.channelId)
        );

        const isSpam = distinctChannels.size >= this.channelSpamThreshold;
        const warning = distinctChannels.size === this.channelSpamThreshold - 1;

        // For debugging ONLY. DO NOT ENABLE IN PRODUCTION
        // console.log(`User ${userId} sent "${content}" in ${distinctChannels.size} distinct channels. Threshold: ${this.channelSpamThreshold}, Warning: ${warning}, Spam: ${isSpam}`);

        if (isSpam) {
            messageHistory.delete(userId); // reset on detection
            return { isSpam: true, warning: false, channels: Array.from(distinctChannels) };
        } else if (warning) {
            return { isSpam: false, warning: true, channels: Array.from(distinctChannels) };
        }

        return null;
    }
}

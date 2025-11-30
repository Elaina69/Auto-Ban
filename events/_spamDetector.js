export class SpamDetector {
    constructor(botConfig = {}) {
        this.updateConfig(botConfig);
        // Temporary memory to store recent messages for multi-channel spam detection
        this.messageHistory = new Map();
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
     * @returns {array|null} - List of channels where the user spammed, or null if not spam
     */
    detectMultiChannelSpam(message) {
        const now = Date.now();
        const userId = message.author.id;
        const content = message.content?.trim?.() || '';

        if (!content) return null;

        if (!this.messageHistory.has(userId)) {
            this.messageHistory.set(userId, []);
        }

        const history = this.messageHistory.get(userId);

        history.push({
            channelId: message.channel.id,
            content,
            timestamp: now
        });

        const recent = history.filter(msg => now - msg.timestamp <= this.spamWindowMs);
        this.messageHistory.set(userId, recent);

        // Check multi-channel spam (spam same content in >= threshold channels)
        const distinctChannels = new Set(
            recent
                .filter(msg => msg.content === content)
                .map(msg => msg.channelId)
        );

        if (distinctChannels.size >= this.channelSpamThreshold) {
            this.messageHistory.delete(userId); // reset on detection
            return Array.from(distinctChannels);
        }

        return null;
    }
}
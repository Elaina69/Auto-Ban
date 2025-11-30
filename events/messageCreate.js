import lang from '../configs/lang.js';
import { format } from '../utils/formatLang.js';
import { configManager } from '../utils/configManager.js';
import { SpamDetector } from './_spamDetector.js';
import { BanManager } from './_banManager.js';

export default async function handleMessageCreate(message, client) {
    const serverConfig = configManager.loadServerConfig();
    const bannedAccounts = await configManager.loadBannedAccounts();
    const botConfig = await configManager.loadBotConfig();

    const spamDetector = new SpamDetector(botConfig);
    const banManager = new BanManager(client);

    try {
        // Ignore messages from bots
        if (!message.guild) return;

        // Get server settings
        const settings = serverConfig[message.guild.id];
        if (!settings) return;

        // Detect spam
        const spamChannels = spamDetector.detectMultiChannelSpam(message);
        const isBannedChannel = spamDetector.isSpamInBannedChannel(message, serverConfig);

        if (!isBannedChannel && !spamChannels) return;

        try {
            // Send DM to banned user
            await banManager.notifyUserBan(message, spamChannels || []);

            // Ban user
            await banManager.banUser(message, bannedAccounts);
            console.log(format(lang.banSuccessLog, { username: message.author.tag, guildId: message.guild.id }));

            // Send message into Notify channel
            await banManager.notifyBan(message, settings, spamChannels || []);

            // Delete user messages if enabled
            if (botConfig.deleteMessage) {
                await banManager.deleteUserMessages(message, botConfig, spamChannels || []);
            }
        } 
        catch (err) {
            // Log error and notify if unable to ban
            console.error(format(lang.cannotBanUserLog, { username: message.author.tag }), err);
            await banManager.notifyBanError(message, settings, err);
        }
    } 
    catch (err) {
        // General error logging
        console.error(format(lang.messageCreateError), err);
    }
}
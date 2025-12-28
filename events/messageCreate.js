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
        const spamResult = spamDetector.detectMultiChannelSpam(message);
        const isBannedChannel = spamDetector.isSpamInBannedChannel(message, serverConfig);

        // Handle warnings
        if (spamResult && spamResult.warning) {
            try {
                // Send warning in channel as reply (visible only to user briefly)
                const warningMsg = await message.reply(format(lang.spamWarningChannel, { user: message.author }));
                // Delete the warning after 10 seconds so only the user sees it
                setTimeout(() => {
                    warningMsg.delete().catch(() => {});
                }, 10000);
            } catch (err) {
                console.warn('Could not send warning in channel:', err.message);
            }

            try {
                // Send DM warning
                await message.author.send(format(lang.spamWarningDM, { serverName: message.guild.name }));
            } catch (err) {
                console.warn(format(lang.cannotSendDM, { "message.author.tag": message.author.tag }), err.message);
            }
        }

        // Check if spam or banned channel
        if (!isBannedChannel && (!spamResult || !spamResult.isSpam)) return;

        try {
            // Send DM to banned user
            await banManager.notifyUserBan(message, settings, spamResult ? spamResult.channels : [], isBannedChannel);

            // Ban user
            await banManager.banUser(message, bannedAccounts, isBannedChannel);
            console.log(format(lang.banSuccessLog, { username: message.author.tag, guildId: message.guild.id }));

            // Send message into Notify channel
            await banManager.notifyBan(message, settings, spamResult ? spamResult.channels : [], isBannedChannel);

            // Delete user messages if enabled
            if (botConfig.deleteMessage) {
                await banManager.deleteUserMessages(message, botConfig, spamResult ? spamResult.channels : []);
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
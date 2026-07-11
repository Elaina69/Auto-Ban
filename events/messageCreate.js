import lang from '../configs/lang.js';
import { format } from '../utils/formatLang.js';
import { configManager } from '../utils/configManager.js';
import { SpamDetector } from './_spamDetector.js';
import { BanManager } from './_banManager.js';
import { raidDetector } from './_raidDetector.js';

export default async function handleMessageCreate(message, client) {
    const serverConfig = configManager.loadServerConfig();
    const bannedAccounts = await configManager.loadBannedAccounts();
    const botConfig = await configManager.loadBotConfig();

    const spamDetector = new SpamDetector(botConfig);
    const banManager = new BanManager(client);

    try {
        // Ignore DMs and bots before any moderation content processing.
        if (!message.guild || message.author.bot) return;

        // Get server settings
        const settings = serverConfig[message.guild.id];
        if (!settings) return;

        // Skip moderation for whitelisted users
        if (Array.isArray(settings.whitelist) && settings.whitelist.includes(message.author.id)) {
            return;
        }

        const raidProtectionEnabled = settings.raidProtection?.enabled &&
            settings.raidProtection?.mode !== 'off';
        if (!settings.bannedChannelId && !raidProtectionEnabled) return;

        // Detect spam
        const spamResult = spamDetector.detectMultiChannelSpam(message);
        const isBannedChannel = settings.bannedChannelId
            ? spamDetector.isSpamInBannedChannel(message, serverConfig)
            : false;
        const raidResult = raidProtectionEnabled
            ? await raidDetector.handleMessage(message)
            : null;

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

        const enforceRaidCampaign = Boolean(raidResult?.isCampaign && raidResult.enforce);
        if (!isBannedChannel && (!spamResult || !spamResult.isSpam) && !enforceRaidCampaign) return;

        const moderation = enforceRaidCampaign ? {
            reason: 'Coordinated join-raid message campaign',
            fingerprint: raidResult.fingerprint,
            incidentId: raidResult.incidentId,
            channelIds: raidResult.channelIds
        } : {
            fingerprint: spamResult?.fingerprint,
            channelIds: spamResult?.channels
        };
        const affectedChannels = raidResult?.channelIds?.length
            ? raidResult.channelIds
            : (spamResult?.channels || []);

        try {
            // Send DM to banned user
            await banManager.notifyUserBan(message, settings, affectedChannels, isBannedChannel, botConfig, moderation);

            // Ban user
            await banManager.banUser(message, bannedAccounts, isBannedChannel, botConfig, moderation);
            if (enforceRaidCampaign) raidDetector.markEnforced(message.guild.id);
            console.log(format(lang.banSuccessLog, { username: message.author.tag, guildId: message.guild.id }));

            // Send message into Notify channel
            await banManager.notifyBan(message, settings, affectedChannels, isBannedChannel, botConfig, moderation);

            // Delete user messages if enabled
            if (botConfig.deleteMessage) {
                await banManager.deleteUserMessages(message, botConfig, affectedChannels);
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

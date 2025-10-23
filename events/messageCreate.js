import lang from '../configs/lang.js';
import { format } from '../utils/formatLang.js';
import { ChannelType } from 'discord.js';
import { saveBannedAccounts } from '../utils/config.js';

// Temporary memory to store recent messages for multi-channel spam detection
const messageHistory = new Map();

/**
 * Checks if a message should be banned.
 * @param {import('discord.js').Message} message - The message object.
 * @param {object} serverConfig - The server configuration.
 * @returns {boolean} - True if the message should be banned, false otherwise.
 */
function shouldBan(message, serverConfig) {
    // If the message is from a bot or not in a guild, don't ban
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
 * @param {object} botConfig
 * @returns {array|null} - List of channels where the user spammed, or null if not spam
 */
function detectMultiChannelSpam(message, botConfig) {
    const now = Date.now();
    const userId = message.author.id;
    const content = message.content.trim();

    if (!content) return null;

    if (!messageHistory.has(userId)) {
        messageHistory.set(userId, []);
    }

    const history = messageHistory.get(userId);

    // Add new message to history
    history.push({
        channelId: message.channel.id,
        content,
        timestamp: now
    });

    // Remove old messages
    const window = botConfig.spamWindowMs
    const threshold = botConfig.channelSpamThreshold
    const recent = history.filter(msg => now - msg.timestamp <= window);
    messageHistory.set(userId, recent);

    // Check multi-channel spam (spam same content in >= threshold channels)
    const distinctChannels = new Set(
        recent
            .filter(msg => msg.content === content)
            .map(msg => msg.channelId)
    );

    if (distinctChannels.size >= threshold) {
        messageHistory.delete(userId); // reset
        return Array.from(distinctChannels);
    }

    return null;
}

/**
 * Bans a user and updates the banned accounts list.
 * @param {import('discord.js').Message} message - The message object.
 * @param {object} bannedAccounts - The banned accounts.
 */
async function banUser(message, bannedAccounts) {
    await message.guild.members.ban(message.author.id, {
        reason: `${lang.banReason}.`
    });

    if (!bannedAccounts[message.guild.id]) bannedAccounts[message.guild.id] = [];
    if (!bannedAccounts[message.guild.id].includes(message.author.tag)) {
        bannedAccounts[message.guild.id].push(message.author.tag);
        saveBannedAccounts(bannedAccounts);
    }
}

/**
 * Sends a notification to the specified channel when a user is banned.
 * @param {import('discord.js').Message} message - The message object.
 * @param {import('discord.js').Client} client - The Discord client.
 * @param {object} settings - The server settings.
 * @param {array} extraChannels - Additional channels where the user spammed.
 */
async function notifyBan(message, client, settings, extraChannels = []) {
    const notifyChannel = await message.guild.channels.fetch(settings.notifyChannelId || settings.bannedChannelId);

    // Check if the notify channel is valid
    if (
        notifyChannel &&
        notifyChannel.isTextBased?.() &&
        notifyChannel.viewable &&
        notifyChannel.permissionsFor(client.user)?.has('SendMessages')
    ) {
        const content = message.content || lang.noMessageContent;

        // List all channels where the user spammed
        let channelsList = [`<#${message.channel.id}>`];
        if (extraChannels.length > 0) {
            for (const id of extraChannels) {
                if (id !== message.channel.id) {
                    const ch = message.guild.channels.cache.get(id);
                    if (ch) channelsList.push(`<#${id}>`);
                }
            }
        }

        await notifyChannel.send({
            embeds: [
                {
                    color: 0xff0000,
                    title: lang.userBannedTitle,
                    fields: [
                        { name: lang.userField, value: `${message.author.tag} (<@${message.author.id}>)`, inline: false },
                        { name: lang.reasonField, value: lang.banReason, inline: false },
                        { name: lang.messageContentField, value: content.substring(0, 1024) || lang.noMessageContent, inline: false },
                        { name: lang.channelField, value: channelsList.join(', '), inline: false }
                    ],
                    timestamp: new Date().toISOString(),
                }
            ]
        });

        // Reupload attachments if exist
        await reuploadAttachments(message, notifyChannel);
    }
}

/**
 * Sends an error notification when unable to ban a user.
 * @param {import('discord.js').Message} message - The message object.
 * @param {import('discord.js').Client} client - The Discord client.
 * @param {object} settings - The server settings.
 * @param {Error} err - The error object.
 */
async function notifyBanError(message, client, settings, err) {
    // Check if the notify channel is valid
    const notifyChannel = await message.guild.channels.fetch(settings.notifyChannelId || settings.bannedChannelId);
    if (
        notifyChannel &&
        notifyChannel.isTextBased?.() &&
        notifyChannel.viewable &&
        notifyChannel.permissionsFor(client.user)?.has('SendMessages')
    ) {
        await notifyChannel.send({
            embeds: [
                {
                    color: 0xffa500,
                    title: lang.cannotBanUserTitle,
                    description: format(lang.cannotBanUserNotify, {
                        username: message.author.tag,
                        channelName: message.channel.name
                    }),
                    fields: [
                        { name: lang.channelField, value: `<#${message.channel.id}>`, inline: true },
                        { name: lang.errorField, value: `\`\`\`${err.message}\`\`\``.substring(0, 1024) }
                    ],
                    timestamp: new Date().toISOString(),
                }
            ]
        });
    }
}

/**
 * Reuploads file attachments.
 * @param {import('discord.js').Message} message - The message object.
 * @param {import('discord.js').TextChannel} notifyChannel - The channel to send the reuploaded files to.
 */
async function reuploadAttachments(message, notifyChannel) {
    if (message.attachments.size > 0) {
        for (const [_, att] of message.attachments) {
            try {
                const response = await fetch(att.url);
                const buffer = Buffer.from(await response.arrayBuffer());

                await notifyChannel.send({
                    content: format(lang.deletedFiles, { tag: message.author.tag, id: att.id }),
                    files: [{ attachment: buffer, name: att.name }]
                });
            } 
            catch (err) {
                console.error(format(lang.downloadFilesErrorLog, { url: att.url }), err.message);
                await notifyChannel.send(format(lang.downloadFilesError, { tag: message.author.tag }) + att.url);
            }
        }
    }
}

/**
 * Deletes messages from a user in specific channels or all channels if not specified.
 * @param {import('discord.js').Message} message - The message object.
 * @param {object} botConfig - The bot configuration.
 * @param {import('discord.js').Client} client - The Discord client.
 * @param {string[]} extraChannels - Optional. List of channel IDs where the user spammed.
 */
async function deleteUserMessages(message, botConfig, client, extraChannels = []) {
    const now = Date.now();
    const timeDeleteMessages = now - botConfig.timeDeleteMessage;

    // If there is a spam channel list, only scan those channels
    const targetChannels = extraChannels.length > 0
        ? extraChannels
        : Array.from(message.guild.channels.cache.keys());

    for (const channelId of targetChannels) {
        const channel = message.guild.channels.cache.get(channelId);
        if (!channel || channel.type !== ChannelType.GuildText) continue;
        if (!channel.viewable || !channel.permissionsFor(client.user)?.has('ManageMessages')) continue;

        try {
            const messages = await channel.messages.fetch({ limit: 100 });
            const userMessages = messages.filter(msg =>
                msg.author.id === message.author.id &&
                msg.createdTimestamp >= timeDeleteMessages
            );

            for (const [_, msg] of userMessages) {
                await msg.delete().catch(() => {});
            }

            if (userMessages.size > 0) {
                console.log(format(lang.deletedMessagesLog, {
                    count: userMessages.size,
                    username: message.author.tag,
                    channelName: channel.name
                }));
            }
        } catch (err) {
            console.warn(format(lang.deleteError, { channelName: channel?.name || channelId }), err.message);
        }
    }
}

/**
 * Handles the message creation event.
 * @param {import('discord.js').Message} message - The message object.
 * @param {object} serverConfig - The server configuration.
 * @param {object} bannedAccounts - The banned accounts.
 * @param {object} botConfig - The bot configuration.
 * @param {import('discord.js').Client} client - The Discord client.
 */
export default async function handleMessageCreate(message, serverConfig, bannedAccounts, botConfig, client) {
    try {
        const settings = serverConfig[message.guild.id];
        if (!settings) return;

        // Spam detection
        const spamChannels = detectMultiChannelSpam(message, botConfig);
        const isBannedChannel = shouldBan(message, serverConfig);

        if (!isBannedChannel && !spamChannels) return;

        try {
            await banUser(message, bannedAccounts);
            console.log(format(lang.banSuccessLog, { username: message.author.tag, guildId: message.guild.id }));

            await notifyBan(message, client, settings, spamChannels || []);
            if (botConfig.deleteMessage) {
                await deleteUserMessages(message, botConfig, client, spamChannels || []);
            }
        } 
        catch (err) {
            console.error(format(lang.cannotBanUserLog, { username: message.author.tag }), err);
            await notifyBanError(message, client, settings, err);
        }
    } 
    catch (err) {
        console.error(format(lang.messageCreateError), err);
    }
}
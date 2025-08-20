import lang from '../configs/lang.js';
import { format } from '../utils/formatLang.js';
import { ChannelType } from 'discord.js';
import { saveBannedAccounts } from '../utils/config.js';

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
 * Bans a user and updates the banned accounts list.
 * @param {import('discord.js').Message} message - The message object.
 * @param {object} bannedAccounts - The banned accounts.
 */
async function banUser(message, bannedAccounts) {
    await message.guild.members.ban(message.author.id, {
        reason: `${lang.banReason}.`
    });

    // Create banned accounts list if not exists
    if (!bannedAccounts[message.guild.id]) bannedAccounts[message.guild.id] = [];

    // Add user to banned accounts list if not already present
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
 */
async function notifyBan(message, client, settings) {
    const notifyChannel = await message.guild.channels.fetch(settings.notifyChannelId);

    // Check if the notify channel is valid
    if (
        notifyChannel &&
        notifyChannel.isTextBased?.() &&
        notifyChannel.viewable &&
        notifyChannel.permissionsFor(client.user)?.has('SendMessages')
    ) {
        let content = message.content || lang.noMessageContent;
        await notifyChannel.send({
            embeds: [
                {
                    color: 0xff0000,
                    title: "🚫 User Banned",
                    fields: [
                        { name: "User", value: `${message.author.tag} (<@${message.author.id}>)`, inline: false },
                        { name: "Reason", value: lang.banReason, inline: false },
                        { name: "Message Content", value: content.substring(0, 1024) || lang.noMessageContent, inline: false },
                        { name: "Channel", value: `<#${message.channel.id}>`, inline: true }
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
    const notifyChannel = await message.guild.channels.fetch(settings.notifyChannelId);

    // Check if the notify channel is valid
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
                    title: "⚠️ Cannot Ban User",
                    description: format(lang.cannotBanUserNotify, { username: message.author.tag, channelName: message.channel.name }),
                    fields: [
                        { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
                        { name: "Error", value: `\`\`\`${err.message}\`\`\``.substring(0, 1024), inline: false }
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
 * Deletes messages from a user in all text channels.
 * @param {import('discord.js').Message} message - The message object.
 * @param {object} botConfig - The bot configuration.
 * @param {import('discord.js').Client} client - The Discord client.
 */
async function deleteUserMessages(message, botConfig, client) {
    const now = Date.now();
    const timeDeleteMessages = now - botConfig.timeDeleteMessage;

    for (const [channelId, channel] of message.guild.channels.cache) {
        // Check if the channel is a text channel and if the bot has permission to manage messages
        if (channel.type !== ChannelType.GuildText || 
            !channel.viewable || 
            !channel.permissionsFor(client.user)?.has('ManageMessages')
        ) continue;

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
                console.log(format(lang.deletedMessagesLog, { count: userMessages.size, username: message.author.tag, channelName: channel.name }));
            }
        } 
        catch (err) {
            console.warn(format(lang.deleteError, { channelName: channel.name }), err.message);
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
        if (!shouldBan(message, serverConfig)) return;

        const settings = serverConfig[message.guild.id];

        try {
            await banUser(message, bannedAccounts);
            console.log(format(lang.banSuccessLog, { username: message.author.tag, guildId: message.guild.id }));
            if (settings.notifyChannelId) {
                await notifyBan(message, client, settings);
            }
            if (botConfig.deleteMessage) {
                await deleteUserMessages(message, botConfig, client);
            }
        } 
        catch (err) {
            console.error(format(lang.cannotBanUserLog, { username: message.author.tag }), err);
            if (settings.notifyChannelId) {
                await notifyBanError(message, client, settings, err);
            }
        }
    } 
    catch (err) {
        console.error(format(lang.messageCreateError), err);
    }
}
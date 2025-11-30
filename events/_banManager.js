import lang from '../configs/lang.js';
import { format } from '../utils/formatLang.js';
import { ChannelType } from 'discord.js';
import { configManager } from '../utils/configManager.js';

export class BanManager {
    constructor(client) {
        this.client = client;
    }

    /**
     * Bans a user and updates the banned accounts list.
     * @param {import('discord.js').Message} message - The message object.
     * @param {object} bannedAccounts - The banned accounts.
     */
    async banUser(message, bannedAccounts) {
        await message.guild.members.ban(message.author.id, {
            reason: `${lang.banReason}.`
        });

        if (!bannedAccounts[message.guild.id]) bannedAccounts[message.guild.id] = [];
        if (!bannedAccounts[message.guild.id].includes(message.author.tag)) {
            bannedAccounts[message.guild.id].push(message.author.tag);
            configManager.saveBannedAccounts(bannedAccounts);
        }
    }

    /**
     * Re-uploads attachments from a message to specified targets (channel and/or user DM).
     * @param {import('discord.js').Message} message - The original message with attachments
     * @param {import('discord.js').TextChannel} notifyChannel - Channel to send attachments to
     * @param {import('discord.js').User} [user] - Optional user to send attachments via DM
     * @returns {Promise<void>}
     */
    async reuploadAttachments(message, notifyChannel, user = null) {
        if (message.attachments.size > 0) {
            for (const [_, att] of message.attachments) {
                try {
                    const response = await fetch(att.url);
                    const buffer = Buffer.from(await response.arrayBuffer());

                    // Send to notify channel
                    if (notifyChannel) {
                        try {
                            await notifyChannel.send({
                                content: format(lang.deletedFiles, { tag: message.author.tag, id: att.id }),
                                files: [{ attachment: buffer, name: att.name }]
                            });
                        } catch (channelErr) {
                            console.error(format(lang.downloadFilesErrorLog, { url: att.url }), channelErr.message);
                            await notifyChannel.send(format(lang.downloadFilesError, { tag: message.author.tag }) + att.url).catch(() => {});
                        }
                    }

                    // Send to user DM if provided
                    if (user) {
                        try {
                            await user.send({
                                content: format(lang.yourDeletedFiles, { name: att.name }),
                                files: [{ attachment: buffer, name: att.name }]
                            });
                        } catch (dmErr) {
                            console.warn(format(lang.sendDMFilesErrorLog, { tag: user.tag }), dmErr.message);
                        }
                    }
                } 
                catch (err) {
                    console.error(format(lang.downloadFilesErrorLog, { url: att.url }), err.message);
                    await notifyChannel.send(format(lang.downloadFilesError, { tag: message.author.tag }) + att.url).catch(() => {});
                }
            }
        }
    }

    /**
     * Sends a notification embed to a specified channel or user DM.
     * @param {object} embedData - Embed configuration
     * @param {object} embedData.color - Embed color (hex)
     * @param {string} embedData.title - Embed title
     * @param {array} embedData.fields - Embed fields array
     * @param {import('discord.js').TextChannel|import('discord.js').User} target - Target channel or user to send to
     * @returns {Promise<boolean>} - True if sent successfully, false otherwise
     */
    async sendNotification(embedData, target) {
        try {
            // Check if target is a TextChannel
            if (target.isTextBased?.()) {
                if (!target.viewable || !target.permissionsFor(this.client.user)?.has('SendMessages')) {
                    return false;
                }
            }
            // Check if target is a User (DM)
            else if (!target.dmChannel && !target.createDM) {
                return false;
            }

            await target.send({
                embeds: [embedData]
            });
            return true;
        } catch (err) {
            console.error(`Failed to send notification to ${target.name || target.tag}:`, err.message);
            return false;
        }
    }

    /**
     * Creates a ban notification embed.
     * @param {import('discord.js').Message} message - The message object.
     * @param {string} serverName - Server name.
     * @param {array} extraChannels - Additional channels where the user spammed.
     * @param {boolean} isDM - Is this for DM (true) or channel (false).
     * @param {array} admins - List of admin user IDs for contact.
     * @returns {object} - Embed object
     */
    createBanEmbed(message, serverName, extraChannels = [], isDM = false, admins = []) {
        const content = message.content || lang.noMessageContent;

        let channelsList = [`<#${message.channel.id}>`];
        if (extraChannels.length > 0) {
            for (const id of extraChannels) {
                if (id !== message.channel.id) {
                    const ch = message.guild.channels.cache.get(id);
                    if (ch) channelsList.push(`<#${id}>`);
                }
            }
        }

        const fields = [
            { name: lang.userField, value: `${message.author.tag} (<@${message.author.id}>)`, inline: false },
            { name: lang.reasonField, value: lang.banReason, inline: false },
            { name: lang.messageContentField, value: content.substring(0, 1024) || lang.noMessageContent, inline: false },
            { name: lang.channelField, value: channelsList.join(', '), inline: false },
            { name: lang.serverField, value: serverName, inline: false }
        ];

        // Add contact admins field if there are admins and it's a DM
        if (isDM && admins.length > 0) {
            const adminMentions = admins.map(id => `<@${id}>`).join(', ');
            fields.push({ name: lang.contactAdminsField, value: adminMentions, inline: false });
        } else if (isDM && admins.length === 0) {
            fields.push({ name: lang.contactAdminsField, value: lang.noAdminsAvailable, inline: false });
        }

        return {
            color: 0xff0000,
            title: isDM ? lang.youBannedTitle : lang.userBannedTitle,
            description: isDM ? format(lang.youBannedDescription, { serverName }) : undefined,
            fields,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Sends a notification to the notify channel when a user is banned.
     * @param {import('discord.js').Message} message - The message object.
     * @param {object} settings - The server settings.
     * @param {array} extraChannels - Additional channels where the user spammed.
     */
    async notifyBan(message, settings, extraChannels = []) {
        const notifyChannel = await message.guild.channels.fetch(settings.notifyChannelId || settings.bannedChannelId);

        if (notifyChannel && notifyChannel.isTextBased?.()) {
            const embed = this.createBanEmbed(message, message.guild.name, extraChannels, false, settings.admins || []);
            await this.sendNotification(embed, notifyChannel);

            // Reupload attachments if exist (to channel)
            await this.reuploadAttachments(message, notifyChannel);
        }
    }

    /**
     * Sends a DM notification to the banned user.
     * @param {import('discord.js').Message} message - The message object.
     * @param {array} extraChannels - Additional channels where the user spammed.
     */
    async notifyUserBan(message, settings, extraChannels = []) {
        try {
            const user = message.author;
            const embed = this.createBanEmbed(message, message.guild.name, extraChannels, true, settings.admins || []);
            await this.sendNotification(embed, user);
            // Reupload attachments if exist (to user DM)
            await this.reuploadAttachments(message, null, user);
        } catch (err) {
            console.warn(format(lang.cannotSendDM, { "message.author.tag": message.author.tag }), err.message);
        }
    }

    /**
     * Deletes messages from a user in specific channels or all channels if not specified.
     * @param {import('discord.js').Message} message - The message object.
     * @param {object} botConfig - The bot configuration.
     * @param {import('discord.js').Client} client - The Discord client.
     * @param {string[]} extraChannels - Optional. List of channel IDs where the user spammed.
     */
    async deleteUserMessages(message, botConfig, extraChannels = []) {
        const now = Date.now();
        const timeDeleteMessages = now - botConfig.timeDeleteMessage;

        const targetChannels = extraChannels.length > 0
            ? extraChannels
            : Array.from(message.guild.channels.cache.keys());

        for (const channelId of targetChannels) {
            const channel = message.guild.channels.cache.get(channelId);
            if (!channel || channel.type !== ChannelType.GuildText) continue;
            if (!channel.viewable || !channel.permissionsFor(this.client.user)?.has('ManageMessages')) continue;

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
     * Sends an error notification when unable to ban a user.
     * @param {import('discord.js').Message} message - The message object.
     * @param {import('discord.js').Client} client - The Discord client.
     * @param {object} settings - The server settings.
     * @param {Error} err - The error object.
     */
    async notifyBanError(message, settings, err) {
        // Check if the notify channel is valid
        const notifyChannel = await message.guild.channels.fetch(settings.notifyChannelId || settings.bannedChannelId);
        if (
            notifyChannel &&
            notifyChannel.isTextBased?.() &&
            notifyChannel.viewable &&
            notifyChannel.permissionsFor(this.client.user)?.has('SendMessages')
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
}
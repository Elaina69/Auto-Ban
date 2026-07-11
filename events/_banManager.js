import lang from '../configs/lang.js';
import { format } from '../utils/formatLang.js';
import { ChannelType, EmbedBuilder } from 'discord.js';
import { configManager } from '../utils/configManager.js';

const DEFAULT_BAN_MESSAGE_CONTENT_POLICY = 'snippet';
const DEFAULT_BAN_MESSAGE_CONTENT_MAX_LENGTH = 512;
const DISCORD_EMBED_FIELD_MAX_LENGTH = 1024;
const DEFAULT_BAN_EVIDENCE_RETENTION_DAYS = 90;

function clampContentLength(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_BAN_MESSAGE_CONTENT_MAX_LENGTH;
    }

    return Math.min(Math.max(parsed, 16), DISCORD_EMBED_FIELD_MAX_LENGTH);
}

function getMessageContentEvidence(message, botConfig = {}) {
    const content = message.content?.trim?.() || '';
    if (!content) return lang.noMessageContent;

    const policy = botConfig.banMessageContentPolicy || DEFAULT_BAN_MESSAGE_CONTENT_POLICY;
    if (policy === 'none') return lang.noMessageContent;

    const maxLength = policy === 'full'
        ? DISCORD_EMBED_FIELD_MAX_LENGTH
        : clampContentLength(botConfig.banMessageContentMaxLength);

    if (content.length <= maxLength) return content;
    return `${content.slice(0, maxLength - 3)}...`;
}

export class BanManager {
    constructor(client) {
        this.client = client;
    }

    /**
     * Builds the persisted ban record for a user.
     * @param {import('discord.js').User|import('discord.js').GuildMember} user - Target user.
     * @param {string} reason - Ban reason.
     * @param {string} lastMessage - Last recorded message content.
     * @returns {object}
     */
    createBanRecord(user, reason, lastMessage = lang.noMessageContent, metadata = {}) {
        const record = {
            displayName: user.displayName || user.globalName || user.username,
            id: user.id,
            time: new Date().toISOString(),
            lastBannedMessage: lastMessage || lang.noMessageContent,
            reason
        };

        for (const key of ['contentFingerprint', 'incidentId', 'messageIds', 'channelIds', 'evidenceExpiresAt']) {
            if (metadata[key] !== undefined && metadata[key] !== null) record[key] = metadata[key];
        }

        return record;
    }

    /**
     * Saves a ban record for a user.
     * @param {string} guildId - Guild ID.
     * @param {import('discord.js').User|import('discord.js').GuildMember} user - Target user.
     * @param {object} bannedAccounts - Persisted banned accounts object.
     * @param {string} reason - Ban reason.
     * @param {string} lastMessage - Last recorded message content.
     */
    saveBanRecord(guildId, user, bannedAccounts, reason, lastMessage = lang.noMessageContent, metadata = {}) {
        const record = this.createBanRecord(user, reason, lastMessage, metadata);

        configManager.updateBannedAccounts(accounts => {
            if (!accounts[guildId]) accounts[guildId] = {};
            accounts[guildId][user.tag] = record;
        });

        if (bannedAccounts) {
            if (!bannedAccounts[guildId]) bannedAccounts[guildId] = {};
            bannedAccounts[guildId][user.tag] = record;
        }
    }

    /**
     * Removes a persisted ban record by user ID.
     * @param {string} guildId - Guild ID.
     * @param {string} userId - User ID.
     * @param {object} bannedAccounts - Persisted banned accounts object.
     */
    removeBanRecord(guildId, userId, bannedAccounts) {
        configManager.updateBannedAccounts(accounts => {
            if (!accounts[guildId]) return;

            for (const [username, info] of Object.entries(accounts[guildId])) {
                if (info?.id === userId) {
                    delete accounts[guildId][username];
                }
            }
        });

        if (bannedAccounts?.[guildId]) {
            for (const [username, info] of Object.entries(bannedAccounts[guildId])) {
                if (info?.id === userId) {
                    delete bannedAccounts[guildId][username];
                }
            }
        }
    }

    /**
     * Bans a guild user and updates the persisted ban list.
     * @param {import('discord.js').Guild} guild - Guild instance.
     * @param {import('discord.js').User|import('discord.js').GuildMember} user - Target user.
     * @param {object} bannedAccounts - Persisted banned accounts object.
     * @param {object} options - Ban options.
     * @param {string} options.reason - Ban reason.
     * @param {string} [options.lastMessage] - Last recorded message content.
     */
    async banGuildUser(guild, user, bannedAccounts, { reason, lastMessage = lang.noMessageContent, metadata = {} }) {
        await guild.members.ban(user.id, { reason });
        this.saveBanRecord(guild.id, user, bannedAccounts, reason, lastMessage, metadata);
    }

    /**
     * Unbans a guild user and removes the persisted ban record.
     * @param {import('discord.js').Guild} guild - Guild instance.
     * @param {string} userId - Target user ID.
     * @param {object} bannedAccounts - Persisted banned accounts object.
     */
    async unbanGuildUser(guild, userId, bannedAccounts) {
        await guild.members.unban(userId);
        this.removeBanRecord(guild.id, userId, bannedAccounts);
    }

    /**
     * Bans a user and updates the banned accounts list.
     * @param {import('discord.js').Message} message - The message object.
     * @param {object} bannedAccounts - The banned accounts.
     * @param {boolean} isBannedChannel - Whether the ban is from banned channel or spam.
     * @param {object} [botConfig] - Bot configuration for moderation evidence policy.
     */
    async banUser(message, bannedAccounts, isBannedChannel = false, botConfig = {}, moderation = {}) {
        const reason = moderation.reason ||
            (isBannedChannel ? lang.banReasonBannedChannel : lang.banReasonSpam);
        const retentionDays = Math.min(Math.max(
            Number.parseInt(botConfig.banEvidenceRetentionDays, 10) || DEFAULT_BAN_EVIDENCE_RETENTION_DAYS,
            1
        ), 365);

        await this.banGuildUser(message.guild, message.author, bannedAccounts, {
            reason,
            lastMessage: getMessageContentEvidence(message, botConfig),
            metadata: {
                contentFingerprint: moderation.fingerprint,
                incidentId: moderation.incidentId,
                messageIds: message.id ? [message.id] : undefined,
                channelIds: moderation.channelIds?.length
                    ? [...new Set(moderation.channelIds)]
                    : [message.channel.id],
                evidenceExpiresAt: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString()
            }
        });
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
     * @param {boolean} isBannedChannel - Whether the ban is from banned channel or spam.
     * @param {object} [botConfig] - Bot configuration for moderation evidence policy.
     * @returns {EmbedBuilder} - Embed builder object
     */
    createBanEmbed(message, serverName, extraChannels = [], isDM = false, admins = [], isBannedChannel = false, botConfig = {}, moderation = {}) {
        const content = getMessageContentEvidence(message, botConfig);
        const reason = moderation.reason ||
            (isBannedChannel ? lang.banReasonBannedChannel : lang.banReasonSpam);

        let channelsList = [`<#${message.channel.id}>`];
        if (extraChannels.length > 0) {
            for (const id of extraChannels) {
                if (id !== message.channel.id) {
                    const ch = message.guild.channels.cache.get(id);
                    if (ch) channelsList.push(`<#${id}>`);
                }
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle(isDM ? lang.youBannedTitle : lang.userBannedTitle)
            .addFields(
                { name: lang.userField, value: `${message.author.tag} (<@${message.author.id}>)`, inline: false },
                { name: lang.reasonField, value: reason, inline: false },
                { name: lang.messageContentField, value: content || lang.noMessageContent, inline: false },
                { name: lang.channelField, value: channelsList.join(', '), inline: false },
                { name: lang.serverField, value: serverName, inline: false }
            )
            .setTimestamp();

        // Add description for DM messages
        if (isDM) {
            embed.setDescription(format(lang.youBannedDescription, { serverName }));
        }

        // Add contact admins field if there are admins and it's a DM
        if (isDM && admins.length > 0) {
            const adminMentions = admins.map(id => `<@${id}>`).join(', ');
            embed.addFields({ name: lang.contactAdminsField, value: adminMentions, inline: false });
        } else if (isDM && admins.length === 0) {
            embed.addFields({ name: lang.contactAdminsField, value: lang.noAdminsAvailable, inline: false });
        }

        if (moderation.incidentId) {
            embed.addFields({ name: 'Incident ID', value: moderation.incidentId, inline: false });
        }

        return embed;
    }

    /**
     * Sends a notification to the notify channel when a user is banned.
     * @param {import('discord.js').Message} message - The message object.
     * @param {object} settings - The server settings.
     * @param {array} extraChannels - Additional channels where the user spammed.
     * @param {boolean} isBannedChannel - Whether the ban is from banned channel or spam.
     * @param {object} [botConfig] - Bot configuration for moderation evidence policy.
     */
    async notifyBan(message, settings, extraChannels = [], isBannedChannel = false, botConfig = {}, moderation = {}) {
        const notifyChannelId = settings.notifyChannelId ||
            settings.raidProtection?.notifyChannelId ||
            settings.bannedChannelId;
        const notifyChannel = notifyChannelId
            ? await message.guild.channels.fetch(notifyChannelId)
            : null;

        if (notifyChannel && notifyChannel.isTextBased?.()) {
            const embed = this.createBanEmbed(message, message.guild.name, extraChannels, false, settings.admins || [], isBannedChannel, botConfig, moderation);
            await this.sendNotification(embed, notifyChannel);

            // Attachment re-upload is opt-in because it downloads and reposts user-provided files.
            if (botConfig.reuploadModerationAttachments) {
                await this.reuploadAttachments(message, notifyChannel);
            }
        }
    }

    /**
     * Sends a DM notification to the banned user.
     * @param {import('discord.js').Message} message - The message object.
     * @param {object} settings - The server settings.
     * @param {array} extraChannels - Additional channels where the user spammed.
     * @param {boolean} isBannedChannel - Whether the ban is from banned channel or spam.
     * @param {object} [botConfig] - Bot configuration for moderation evidence policy.
     */
    async notifyUserBan(message, settings, extraChannels = [], isBannedChannel = false, botConfig = {}, moderation = {}) {
        try {
            const user = message.author;
            const embed = this.createBanEmbed(message, message.guild.name, extraChannels, true, settings.admins || [], isBannedChannel, botConfig, moderation);
            await this.sendNotification(embed, user);
            // Attachment re-upload is opt-in because it downloads and reposts user-provided files.
            if (botConfig.reuploadModerationAttachments) {
                await this.reuploadAttachments(message, null, user);
            }
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
        const notifyChannelId = settings.notifyChannelId ||
            settings.raidProtection?.notifyChannelId ||
            settings.bannedChannelId;
        const notifyChannel = notifyChannelId
            ? await message.guild.channels.fetch(notifyChannelId)
            : null;
        if (
            notifyChannel &&
            notifyChannel.isTextBased?.() &&
            notifyChannel.viewable &&
            notifyChannel.permissionsFor(this.client.user)?.has('SendMessages')
        ) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xffa500)
                .setTitle(lang.cannotBanUserTitle)
                .setDescription(format(lang.cannotBanUserNotify, {
                    username: message.author.tag,
                    channelName: message.channel.name
                }))
                .addFields(
                    { name: lang.channelField, value: `<#${message.channel.id}>`, inline: true },
                    { name: lang.errorField, value: `\`\`\`${err.message}\`\`\``.substring(0, 1024) }
                )
                .setTimestamp();

            await notifyChannel.send({
                embeds: [errorEmbed]
            });
        }
    }
}

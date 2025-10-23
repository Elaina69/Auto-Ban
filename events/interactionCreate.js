import lang from '../configs/lang.js';
import { format } from '../utils/formatLang.js';
import { MessageFlags, PermissionFlagsBits, ChannelType } from 'discord.js';
import { loadBotConfig, saveServerConfig } from '../utils/config.js';
import handleMessageCreate from './messageCreate.js';

/**
 * Handles interaction events.
 * @param {import('discord.js').Interaction} interaction - The interaction object.
 * @param {object} serverConfig - The server configuration.
 * @param {object} bannedAccounts - The banned accounts.
 * @returns {Promise<void>}
 */
export default async function handleInteractionCreate(interaction, serverConfig, bannedAccounts) {
    // Check if the interaction is a chat input command
    if (!interaction.isChatInputCommand()) return;

    // Command: /setup (channel to ban) (channel to notify)
    if (interaction.commandName === 'setup') {
        const guildId = interaction.guildId;
        const channelToBan = interaction.options.getChannel('channeltoban');
        let notifyChannel = interaction.options.getChannel('notifychannel');

        // If no notify channel is provided, use the channel to ban
        if (!notifyChannel) notifyChannel = channelToBan;

        serverConfig[guildId] = {
            bannedChannelId: channelToBan.id,
            notifyChannelId: notifyChannel.id
        };
        saveServerConfig(serverConfig);

        await interaction.reply({
            content: `${lang.setupCompleted}\n- ${format(lang.bannedChannel, { channelToBan: channelToBan })}` +
                (notifyChannel ? `\n- ${format(lang.notifyChannel, { notifyChannel: notifyChannel })}` : ''),
            flags: MessageFlags.Ephemeral
        });
    }

    // Command: /banlist
    if (interaction.commandName === 'banlist') {
        const guildId = interaction.guildId;
        const list = bannedAccounts[guildId] || [];

        if (list.length === 0) {
            await interaction.reply({
                content: lang.noBannedAccounts,
                flags: MessageFlags.Ephemeral
            });
        } 
        else {
            const lines = [];
            for (let i = 0; i < list.length; i += 5) {
                lines.push(list.slice(i, i + 5).join(', '));
            }

            const formattedList = lines.join('\n');

            await interaction.reply({
                content: format(lang.bannedAccountsList, { list: formattedList }) + `\n\n(Total: ${list.length})`,
                flags: MessageFlags.Ephemeral
            });
        }
    }

    // Command: /checkperm
    if (interaction.commandName === 'checkperm') {
        // Get the channel to check permissions, default to current channel if not provided
        let channel = interaction.options.getChannel('channel') || interaction.channel;

        // Get the bot's permissions in that channel
        const permissions = channel.permissionsFor(interaction.client.user);

        // List of permissions to check
        const requiredPerms = [
            { name: lang.permViewChannel, perm: PermissionFlagsBits.ViewChannel },
            { name: lang.permSendMessages, perm: PermissionFlagsBits.SendMessages },
            { name: lang.permReadMessageHistory, perm: PermissionFlagsBits.ReadMessageHistory },
            { name: lang.permAddReactions, perm: PermissionFlagsBits.AddReactions },
            { name: lang.permManageMessages, perm: PermissionFlagsBits.ManageMessages },
            { name: lang.permBanMembers, perm: PermissionFlagsBits.BanMembers }
        ];

        let result = format(lang.botPermissionInChannel, { channel: channel }) + '\n';
        for (const p of requiredPerms) {
            result += `- ${p.name}: ${permissions.has(p.perm) ? '✅' : '❌'}\n`;
        }

        await interaction.reply({
            content: result,
            flags: MessageFlags.Ephemeral
        });
    }

    // Command: /bantest
    if (interaction.commandName === 'bantest') {
        const botConfig = await loadBotConfig();

        const mode = interaction.options.getString('mode') || 'normal';
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        const guild = interaction.guild;
        const user = interaction.user;
        const client = interaction.client;

        // Simulated message for testing
        const fakeMessage = {
            author: user,
            guild,
            channel: interaction.channel,
            content: 'Test spam message',
            attachments: new Map(),
            createdTimestamp: Date.now(),
            async delete() {}
        };

        if (mode === 'normal') {
            await interaction.editReply(lang.testingAutoBan);
            await handleMessageCreate(fakeMessage, serverConfig, bannedAccounts, botConfig, client);
            await interaction.followUp({ 
                content: lang.testNormalModeDone, 
                flags: MessageFlags.Ephemeral
            });
        }

        if (mode === 'multichannel') {
            await interaction.editReply(lang.testingMultiChannelSpam);
            const channels = guild.channels.cache.filter(
                ch => ch.type === ChannelType.GuildText &&
                    ch.viewable &&
                    ch.permissionsFor(client.user)?.has('SendMessages')
            ).first(3);

            if (channels.length < 3) {
                await interaction.followUp(lang.needAtLeast3Channels);
                return;
            }

            for (const ch of channels) {
                const fakeSpamMsg = { ...fakeMessage, channel: ch, content: 'Spam test message' };
                await handleMessageCreate(fakeSpamMsg, serverConfig, bannedAccounts, botConfig, client);
            }

            await interaction.followUp({ 
                content: lang.testMultiChannelDone,
                flags: MessageFlags.Ephemeral
            });
        }
    }
}

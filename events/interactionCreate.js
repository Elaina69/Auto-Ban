import lang from '../configs/lang.js';
import { format } from '../utils/formatLang.js';
import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { saveServerConfig } from '../utils/config.js';

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
        } else {
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

    if (interaction.commandName === 'checkperm') {
        // Get the channel to check permissions, default to current channel if not provided
        let channel = interaction.options.getChannel('channel');
        if (!channel) channel = interaction.channel;

        // Get the bot's permissions in that channel
        const permissions = channel.permissionsFor(interaction.client.user);

        // List of permissions to check
        const requiredPerms = [
            { name: 'View Channel', perm: PermissionFlagsBits.ViewChannel },
            { name: 'Send Messages', perm: PermissionFlagsBits.SendMessages },
            { name: 'Read Message History', perm: PermissionFlagsBits.ReadMessageHistory },
            { name: 'Add Reactions', perm: PermissionFlagsBits.AddReactions },
            { name: 'Manage Messages', perm: PermissionFlagsBits.ManageMessages },
            { name: 'Ban Members', perm: PermissionFlagsBits.BanMembers }
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
}
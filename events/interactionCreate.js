import lang from '../configs/lang.js';
import { format } from '../utils/formatLang.js';
import { MessageFlags } from 'discord.js';
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

    if (interaction.commandName === 'banlist') {
        const guildId = interaction.guildId;
        const list = bannedAccounts[guildId] || [];

        const pageSize = 10;
        let page = 0;
        const totalPages = Math.ceil(list.length / pageSize) || 1;

        function getPageContent(page) {
            const start = page * pageSize;
            const end = start + pageSize;
            const users = list.slice(start, end).map(acc => `- ${acc}`).join('\n') || lang.noBannedAccounts;
            return format(lang.bannedAccountsList, { users }) + `\n\nPage ${page + 1}/${totalPages}`;
        }

        const replyMsg = await interaction.reply({
            content: getPageContent(page),
            fetchReply: true,
            flags: MessageFlags.SuppressNotifications
        });

        if (list.length <= pageSize) return;

        // Thêm emoji điều hướng
        await replyMsg.react('⬅️');
        await replyMsg.react('➡️');

        // Collector cho emoji
        const filter = (reaction, user) =>
            ['⬅️', '➡️'].includes(reaction.emoji.name) && user.id === interaction.user.id;
        const collector = replyMsg.createReactionCollector({ filter, time: 60000 });

        collector.on('collect', async (reaction, user) => {
            if (reaction.emoji.name === '⬅️' && page > 0) page--;
            if (reaction.emoji.name === '➡️' && page < totalPages - 1) page++;
            await replyMsg.edit({ content: getPageContent(page) });
            await reaction.users.remove(user.id); // Xóa emoji của user để có thể ấn tiếp
        });

        collector.on('end', () => {
            replyMsg.reactions.removeAll().catch(() => {});
        });
    }
}
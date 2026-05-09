import lang from '../../configs/lang.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { configManager } from '../../utils/configManager.js';

export async function getWhitelistCommand(interaction) {
    const serverConfig = configManager.loadServerConfig();
    const whitelist = Array.isArray(serverConfig[interaction.guildId]?.whitelist)
        ? serverConfig[interaction.guildId].whitelist
        : [];

    if (whitelist.length === 0) {
        return interaction.reply({
            content: lang.noWhitelistedAccounts,
            flags: MessageFlags.Ephemeral
        });
    }

    const resolvedUsers = await Promise.all(
        whitelist.map(async (userId) => {
            try {
                const user = await interaction.client.users.fetch(userId);
                return `${user.tag} (<@${userId}>)`;
            } catch {
                return `<@${userId}> (${userId})`;
            }
        })
    );

    const perPage = 10;
    const pages = [];
    for (let index = 0; index < resolvedUsers.length; index += perPage) {
        pages.push(
            resolvedUsers
                .slice(index, index + perPage)
                .map((entry, offset) => `${index + offset + 1}. ${entry}`)
                .join('\n')
        );
    }

    let page = 0;
    const getContent = () => {
        return `${lang.whitelistedAccountsList}\n\n${pages[page]}\n\nPage ${page + 1}/${pages.length} (Total: ${resolvedUsers.length})`;
    };

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('⬅️ Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next ➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === pages.length - 1)
    );

    const reply = await interaction.reply({
        content: getContent(),
        components: pages.length > 1 ? [row] : [],
        flags: MessageFlags.Ephemeral,
        fetchReply: true
    });

    if (pages.length <= 1) return;

    const collector = reply.createMessageComponentCollector({ time: 5 * 60 * 1000 });

    collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.user.id !== interaction.user.id) {
            return buttonInteraction.reply({
                content: lang.notYourButton,
                flags: MessageFlags.Ephemeral
            });
        }

        if (buttonInteraction.customId === 'prev' && page > 0) page--;
        if (buttonInteraction.customId === 'next' && page < pages.length - 1) page++;

        const updatedRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('prev')
                .setLabel('⬅️ Prev')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId('next')
                .setLabel('Next ➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === pages.length - 1)
        );

        await buttonInteraction.update({
            content: getContent(),
            components: [updatedRow]
        });
    });

    collector.on('end', async () => {
        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('prev')
                .setLabel('⬅️ Prev')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('next')
                .setLabel('Next ➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        await interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });
}
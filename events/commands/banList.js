import lang from '../../configs/lang.js';
import { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { loadBannedAccounts } from '../../utils/configManager.js';

export async function banListCommand(interaction) {
    const guildId = interaction.guildId;
    const bannedAccounts = await loadBannedAccounts();
    const list = bannedAccounts[guildId] || [];

     if (list.length === 0) {
        await interaction.reply({
            content: lang.noBannedAccounts,
            flags: MessageFlags.Ephemeral
        });

        return
    } 

    // Split into pages of 10 users each
    const itemsPerPage = 10;
    const pages = [];
    for (let i = 0; i < list.length; i += itemsPerPage) {
        const pageUsers = list.slice(i, i + itemsPerPage);
        const pageContent = pageUsers.map((user, index) => 
            `${i + index + 1}. ${user}`
        ).join('\n');
        pages.push(pageContent);
    }

    let currentPage = 0;

    // Create navigation buttons
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('prev')
                .setLabel('◀️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('next')
                .setLabel('▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(pages.length <= 1)
        );

    // Function to get page content
    const getPageContent = (page) => {
        return `${lang.bannedAccountsList}\n\n${pages[page]}\n\nPage ${page + 1}/${pages.length} (Total: ${list.length})`;
    };

    // Send initial message with buttons
        const reply = await interaction.reply({
        content: getPageContent(currentPage),
        components: [row],
        flags: MessageFlags.Ephemeral
    });

    // Create button collector
    const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: i => i.user.id === interaction.user.id && i.message.interaction.id === interaction.id,
        time: 300000 // 5 minutes
    });

    collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
            await i.reply({
                    content: lang.notYourButton,
                ephemeral: true
            });
            return;
        }

        // Update current page
        if (i.customId === 'prev' && currentPage > 0) currentPage--;
        if (i.customId === 'next' && currentPage < pages.length - 1) currentPage++;

        // Update button states
        row.components[0].setDisabled(currentPage === 0);
        row.components[1].setDisabled(currentPage === pages.length - 1);

        // Update message
        await i.update({
            content: getPageContent(currentPage),
            components: [row]
        });
    });

    collector.on('end', () => {
        row.components.forEach(button => button.setDisabled(true));
        interaction.editReply({
            components: [row]
        }).catch(() => {});
    });
}
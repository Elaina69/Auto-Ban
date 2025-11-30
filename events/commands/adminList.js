import lang from '../../configs/lang.js';
import { format } from '../../utils/formatLang.js';
import { EmbedBuilder } from 'discord.js';
import { configManager } from '../../utils/configManager.js';

export async function adminList(interaction) {
    try {
        // Check if user has permission
        if (!interaction.member.permissions.has('Administrator')) {
            return await interaction.reply({
                content: lang.noPermissionToViewAdmins,
                ephemeral: true
            });
        }

        // Get server settings from configManager
        const serverConfig = configManager.loadServerConfig();
        const guildId = interaction.guildId;
        const settings = serverConfig[guildId] || {};
        const admins = Array.isArray(settings.admins) ? settings.admins : (Array.isArray(settings.adminIds) ? settings.adminIds : []);

        // Create embed
        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(format(lang.adminListTitle, { serverName: interaction.guild.name }))
            .setDescription(admins.length > 0 ? lang.adminListDescription : lang.noAdminsAvailable)
            .setTimestamp();

        if (admins.length > 0) {
            const adminList = admins
                .map(id => `<@${id}>`)
                .join('\n');
            
            embed.addFields({
                name: lang.adminField,
                value: adminList || lang.noAdminsAvailable,
                inline: false
            });

            embed.setFooter({ text: format(lang.totalAdmins, { count: admins.length }) });
        }

        await interaction.reply({
            embeds: [embed],
            ephemeral: false
        });
    } catch (err) {
        console.error('Error in adminList command:', err.message);
        await interaction.reply({
            content: lang.adminListCommandError + err.message,
            ephemeral: true
        }).catch(() => {});
    }
}
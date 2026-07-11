import lang from '../../configs/lang.js';
import { format } from '../../utils/formatLang.js';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { configManager } from '../../utils/configManager.js';

export async function getBanInfoCommand(interaction) {
    try {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: 'This command requires server Administrator permission.',
                flags: MessageFlags.Ephemeral
            });
        }

        const username = interaction.options.getString('username');
        const guildId = interaction.guildId;

        // Load banned accounts
        const bannedAccounts = await configManager.loadBannedAccounts();
        const guildBans = bannedAccounts[guildId] || {};

        // Check if user exists in banned list
        if (!guildBans[username]) {
            return await interaction.reply({
                content: format(lang.getBanInfoNotFound, { username }),
                flags: MessageFlags.Ephemeral
            });
        }

        const banInfo = guildBans[username];

        // Create embed with ban information
        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle(lang.getBanInfoTitle)
            .addFields(
                { name: lang.getBanInfoUserField, value: username, inline: false },
                { name: lang.getBanInfoDisplayNameField, value: banInfo.displayName || 'N/A', inline: true },
                { name: lang.getBanInfoIdField, value: banInfo.id || 'N/A', inline: true },
                { name: lang.getBanInfoTimeField, value: banInfo.time ? `<t:${Math.floor(new Date(banInfo.time).getTime() / 1000)}:F>` : 'N/A', inline: false },
                { name: lang.getBanInfoReasonField, value: banInfo.reason || lang.banReasonSpam, inline: false },
                { name: lang.getBanInfoMessageField, value: banInfo.lastBannedMessage ? banInfo.lastBannedMessage.substring(0, 1024) : lang.noMessageContent, inline: false }
            )
            .setTimestamp();

        if (banInfo.incidentId) {
            embed.addFields({ name: 'Incident ID', value: banInfo.incidentId, inline: true });
        }
        if (banInfo.evidenceExpiresAt) {
            embed.addFields({
                name: 'Evidence expires',
                value: `<t:${Math.floor(Date.parse(banInfo.evidenceExpiresAt) / 1000)}:F>`,
                inline: true
            });
        }

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
    } catch (err) {
        console.error('Error in getBanInfo command:', err.message);
        await interaction.reply({
            content: format(lang.getBanInfoError, { error: err.message }),
            flags: MessageFlags.Ephemeral
        }).catch(() => {});
    }
}

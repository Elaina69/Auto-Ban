import { EmbedBuilder, MessageFlags } from 'discord.js';
import { configManager } from '../../utils/configManager.js';

export async function privacyCommand(interaction) {
    const botConfig = await configManager.loadBotConfig();
    const raidSettings = interaction.inGuild()
        ? configManager.loadServerConfig()[interaction.guildId]?.raidProtection
        : null;

    const embed = new EmbedBuilder()
        .setColor(0x2f855a)
        .setTitle('Auto-Ban data and privacy status')
        .addFields(
            { name: 'Message processing', value: 'Moderation only. Recent history stores HMAC fingerprints in RAM, not raw message text.', inline: false },
            { name: 'Ban evidence', value: `${botConfig.banMessageContentPolicy || 'snippet'}; expires after ${botConfig.banEvidenceRetentionDays || 90} days`, inline: true },
            { name: 'Attachments', value: botConfig.reuploadModerationAttachments ? 'Opt-in re-upload enabled' : 'Re-upload disabled', inline: true },
            { name: 'Raid incidents', value: raidSettings?.enabled
                ? `Enabled; encrypted summaries retained ${raidSettings.incidentRetentionDays || 30} days`
                : 'Disabled for this server', inline: false },
            { name: 'Member data', value: 'No full member list is persisted. Active raid cohorts exist in RAM; incident records contain only affected user IDs and action counts.', inline: false },
            { name: 'Deletion', value: 'Administrators can use `/deletebandata` for a user. Expired evidence and incident summaries are pruned automatically.', inline: false }
        )
        .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

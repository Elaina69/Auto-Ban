import { MessageFlags } from 'discord.js';
import { farmManager } from '../../../utils/farmManager.js';

export async function farmPrefixCommand(interaction) {
    const guildId = interaction.guildId;
    const newPrefix = interaction.options.getString('prefix');
    
    // Validate prefix (1-3 characters, no spaces)
    if (!newPrefix || newPrefix.length > 3 || /\s/.test(newPrefix)) {
        await interaction.reply({
            content: '❌ Invalid prefix! Prefix must be 1-3 characters and contain no spaces.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }
    
    farmManager.setServerPrefix(guildId, newPrefix);
    
    await interaction.reply({
        content: `✅ Farm command prefix changed to: \`${newPrefix}\`\nExample: \`${newPrefix}help\`, \`${newPrefix}status\`, \`${newPrefix}grow tomato\``,
        flags: MessageFlags.Ephemeral
    });
}

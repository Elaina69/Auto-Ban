import { MessageFlags } from 'discord.js';
import { farmManager } from '../../../utils/farmManager.js';

export async function farmEnableCommand(interaction, action) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    const enabled = action === 'enable';
    farmManager.setFarmingEnabled(userId, guildId, enabled);
    
    const prefix = farmManager.getServerPrefix(guildId);
    const message = enabled 
        ? `✅ Farming mode enabled! Use \`${prefix}help\` to see available commands.`
        : '❌ Farming mode disabled.';
    
    await interaction.reply({
        content: message,
        flags: MessageFlags.Ephemeral
    });
}

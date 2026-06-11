import { MessageFlags } from 'discord.js';
import { configManager } from '../../utils/configManager.js';
import lang from '../../configs/lang.js';
import { format } from '../../utils/formatLang.js';

export async function setupCommand(interaction) {
    const guildId = interaction.guildId;
    const channelToBan = interaction.options.getChannel('channeltoban');
    let notifyChannel = interaction.options.getChannel('notifychannel');
    
    // If no notify channel is provided, use the channel to ban
    if (!notifyChannel) notifyChannel = channelToBan;
    
    configManager.updateServerConfig(serverConfig => {
        const previousSettings = serverConfig[guildId] || {};
        serverConfig[guildId] = {
            ...previousSettings,
            bannedChannelId: channelToBan.id,
            notifyChannelId: notifyChannel.id
        };
    });
    
    await interaction.reply({
        content: `${lang.setupCompleted}\n- ${format(lang.bannedChannel, { channelToBan: channelToBan })}` +
            (notifyChannel ? `\n- ${format(lang.notifyChannel, { notifyChannel: notifyChannel })}` : ''),
        flags: MessageFlags.Ephemeral
    });
}

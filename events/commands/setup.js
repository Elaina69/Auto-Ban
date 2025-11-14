import { MessageFlags } from 'discord.js';
import { saveServerConfig, loadServerConfig } from '../../utils/configManager.js';
import lang from '../../configs/lang.js';
import { format } from '../../utils/formatLang.js';

export async function setupCommand(interaction) {
    const guildId = interaction.guildId;
    const serverConfig = loadServerConfig();
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
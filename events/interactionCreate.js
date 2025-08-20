import lang from '../configs/lang.js';
import { format } from '../utils/formatLang.js';
import { MessageFlags } from 'discord.js';
import { saveServerConfig } from '../utils/config.js';

export default async function handleInteractionCreate(interaction, serverConfig, bannedAccounts) {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'setup') {
        const guildId = interaction.guildId;
        const channelToBan = interaction.options.getChannel('channeltoban');
        let notifyChannel = interaction.options.getChannel('notifychannel');

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
        if (list.length === 0) {
            await interaction.reply({
                content: lang.noBannedAccounts,
                flags: MessageFlags.Ephemeral
            });
        } 
        else {
            const names = list.map(acc => `- ${acc}`).join("\n");
            await interaction.reply({
                content: format(lang.bannedAccountsList, { list: names }),
                flags: MessageFlags.Ephemeral
            });
        }
    }
}
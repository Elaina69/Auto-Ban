import { MessageFlags } from 'discord.js';
import { configManager } from '../../utils/configManager.js';
import lang from '../../configs/lang.js';
import { format } from '../../utils/formatLang.js';

export async function deleteAdminCommand(interaction) {
    const guildId = interaction.guildId;
    const serverConfig = await configManager.loadServerConfig();
    const userToRemove = interaction.options.getUser('user');

    if (!serverConfig[guildId] || !serverConfig[guildId].admins || !serverConfig[guildId].admins.includes(userToRemove.id)) {
        await interaction.reply({
            content: format(lang.adminNotFound, { user: userToRemove }),
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    serverConfig[guildId].admins = serverConfig[guildId].admins.filter(id => id !== userToRemove.id);
    configManager.saveServerConfig(serverConfig);

    await interaction.reply({
        content: format(lang.adminRemoved, { user: userToRemove }),
        flags: MessageFlags.Ephemeral
    });
}

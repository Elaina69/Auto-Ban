import { MessageFlags } from 'discord.js';
import { configManager } from '../../utils/configManager.js';
import lang from '../../configs/lang.js';
import { format } from '../../utils/formatLang.js';

export async function addAdminCommand(interaction) {
    const guildId = interaction.guildId;
    const serverConfig = await configManager.loadServerConfig();
    const userToAdd = interaction.options.getUser('user');

    if (!serverConfig[guildId]) {
        serverConfig[guildId] = {};
    }
    if (!serverConfig[guildId].admins) {
        serverConfig[guildId].admins = [];
    }

    if (serverConfig[guildId].admins.includes(userToAdd.id)) {
        await interaction.reply({
            content: format(lang.adminAlreadyExists, { user: userToAdd }),
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    serverConfig[guildId].admins.push(userToAdd.id);
    configManager.saveServerConfig(serverConfig);

    await interaction.reply({
        content: format(lang.adminAdded, { user: userToAdd }),
        flags: MessageFlags.Ephemeral
    });
}
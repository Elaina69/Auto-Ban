import { MessageFlags } from 'discord.js';
import { configManager } from '../../utils/configManager.js';
import lang from '../../configs/lang.js';
import { format } from '../../utils/formatLang.js';

export async function addAdminCommand(interaction) {
    const guildId = interaction.guildId;
    const userToAdd = interaction.options.getUser('user');

    const result = configManager.updateServerConfig(serverConfig => {
        if (!serverConfig[guildId]) {
            serverConfig[guildId] = {};
        }
        if (!serverConfig[guildId].admins) {
            serverConfig[guildId].admins = [];
        }

        if (serverConfig[guildId].admins.includes(userToAdd.id)) {
            return { alreadyExists: true };
        }

        serverConfig[guildId].admins.push(userToAdd.id);
        return { alreadyExists: false };
    });

    if (result.alreadyExists) {
        await interaction.reply({
            content: format(lang.adminAlreadyExists, { user: userToAdd }),
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.reply({
        content: format(lang.adminAdded, { user: userToAdd }),
        flags: MessageFlags.Ephemeral
    });
}

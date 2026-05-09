import lang from '../../configs/lang.js';
import { format } from '../../utils/formatLang.js';
import { MessageFlags } from 'discord.js';
import { configManager } from '../../utils/configManager.js';

export async function addWhitelistCommand(interaction) {
    const serverConfig = configManager.loadServerConfig();
    const guildId = interaction.guildId;
    const userToAdd = interaction.options.getUser('user');

    if (!serverConfig[guildId]) {
        serverConfig[guildId] = {};
    }

    if (!Array.isArray(serverConfig[guildId].whitelist)) {
        serverConfig[guildId].whitelist = [];
    }

    if (serverConfig[guildId].whitelist.includes(userToAdd.id)) {
        return interaction.reply({
            content: format(lang.whitelistAlreadyExists, { user: `<@${userToAdd.id}>` }),
            flags: MessageFlags.Ephemeral
        });
    }

    serverConfig[guildId].whitelist.push(userToAdd.id);
    configManager.saveServerConfig(serverConfig);

    return interaction.reply({
        content: format(lang.whitelistAdded, { user: `<@${userToAdd.id}>` }),
        flags: MessageFlags.Ephemeral
    });
}
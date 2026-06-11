import lang from '../../configs/lang.js';
import { format } from '../../utils/formatLang.js';
import { MessageFlags } from 'discord.js';
import { configManager } from '../../utils/configManager.js';

export async function addWhitelistCommand(interaction) {
    const guildId = interaction.guildId;
    const userToAdd = interaction.options.getUser('user');

    const result = configManager.updateServerConfig(serverConfig => {
        if (!serverConfig[guildId]) {
            serverConfig[guildId] = {};
        }

        if (!Array.isArray(serverConfig[guildId].whitelist)) {
            serverConfig[guildId].whitelist = [];
        }

        if (serverConfig[guildId].whitelist.includes(userToAdd.id)) {
            return { alreadyExists: true };
        }

        serverConfig[guildId].whitelist.push(userToAdd.id);
        return { alreadyExists: false };
    });

    if (result.alreadyExists) {
        return interaction.reply({
            content: format(lang.whitelistAlreadyExists, { user: `<@${userToAdd.id}>` }),
            flags: MessageFlags.Ephemeral
        });
    }

    return interaction.reply({
        content: format(lang.whitelistAdded, { user: `<@${userToAdd.id}>` }),
        flags: MessageFlags.Ephemeral
    });
}

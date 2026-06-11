import lang from '../../configs/lang.js';
import { format } from '../../utils/formatLang.js';
import { MessageFlags } from 'discord.js';
import { configManager } from '../../utils/configManager.js';

export async function deleteWhitelistCommand(interaction) {
    const guildId = interaction.guildId;
    const userToRemove = interaction.options.getUser('user');

    const result = configManager.updateServerConfig(serverConfig => {
        const whitelist = Array.isArray(serverConfig[guildId]?.whitelist)
            ? serverConfig[guildId].whitelist
            : [];

        if (!whitelist.includes(userToRemove.id)) {
            return { removed: false };
        }

        serverConfig[guildId].whitelist = whitelist.filter(id => id !== userToRemove.id);
        return { removed: true };
    });

    if (!result.removed) {
        return interaction.reply({
            content: format(lang.whitelistNotFound, { user: `<@${userToRemove.id}>` }),
            flags: MessageFlags.Ephemeral
        });
    }

    return interaction.reply({
        content: format(lang.whitelistRemoved, { user: `<@${userToRemove.id}>` }),
        flags: MessageFlags.Ephemeral
    });
}

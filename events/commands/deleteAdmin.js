import { MessageFlags } from 'discord.js';
import { configManager } from '../../utils/configManager.js';
import lang from '../../configs/lang.js';
import { format } from '../../utils/formatLang.js';

export async function deleteAdminCommand(interaction) {
    const guildId = interaction.guildId;
    const userToRemove = interaction.options.getUser('user');

    const result = configManager.updateServerConfig(serverConfig => {
        if (!serverConfig[guildId] || !serverConfig[guildId].admins || !serverConfig[guildId].admins.includes(userToRemove.id)) {
            return { removed: false };
        }

        serverConfig[guildId].admins = serverConfig[guildId].admins.filter(id => id !== userToRemove.id);
        return { removed: true };
    });

    if (!result.removed) {
        await interaction.reply({
            content: format(lang.adminNotFound, { user: userToRemove }),
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.reply({
        content: format(lang.adminRemoved, { user: userToRemove }),
        flags: MessageFlags.Ephemeral
    });
}

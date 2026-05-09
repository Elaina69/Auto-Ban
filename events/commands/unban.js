import lang from '../../configs/lang.js';
import { format } from '../../utils/formatLang.js';
import { MessageFlags } from 'discord.js';
import { configManager } from '../../utils/configManager.js';
import { BanManager } from '../_banManager.js';

export async function unbanCommand(interaction) {
    try {
        const username = interaction.options.getString('username');
        const bannedAccounts = await configManager.loadBannedAccounts();
        const guildBans = bannedAccounts[interaction.guildId] || {};
        const banInfo = guildBans[username];
        const banManager = new BanManager(interaction.client);

        if (!banInfo?.id) {
            return interaction.reply({
                content: format(lang.getBanInfoNotFound, { username }),
                flags: MessageFlags.Ephemeral
            });
        }

        const existingBan = await interaction.guild.bans.fetch(banInfo.id).catch(() => null);

        if (existingBan) {
            await banManager.unbanGuildUser(interaction.guild, banInfo.id, bannedAccounts);
        } else {
            banManager.removeBanRecord(interaction.guildId, banInfo.id, bannedAccounts);
        }

        return interaction.reply({
            content: format(lang.manualUnbanSuccess, { username }),
            flags: MessageFlags.Ephemeral
        });
    } catch (err) {
        console.error(format(lang.manualUnbanError, { error: err.message }));
        return interaction.reply({
            content: format(lang.manualUnbanError, { error: err.message }),
            flags: MessageFlags.Ephemeral
        }).catch(() => {});
    }
}
import lang from '../../configs/lang.js';
import { format } from '../../utils/formatLang.js';
import { MessageFlags } from 'discord.js';
import { configManager } from '../../utils/configManager.js';
import { BanManager } from '../_banManager.js';

export async function banCommand(interaction) {
    try {
        const user = interaction.options.getUser('user');
        const bannedAccounts = await configManager.loadBannedAccounts();
        const banManager = new BanManager(interaction.client);
        const existingBan = await interaction.guild.bans.fetch(user.id).catch(() => null);

        if (existingBan) {
            return interaction.reply({
                content: format(lang.manualBanAlreadyBanned, { user: `<@${user.id}>` }),
                flags: MessageFlags.Ephemeral
            });
        }

        await banManager.banGuildUser(interaction.guild, user, bannedAccounts, {
            reason: lang.manualBanReason,
            lastMessage: lang.manualBanNoMessage
        });

        return interaction.reply({
            content: format(lang.manualBanSuccess, { user: `<@${user.id}>` }),
            flags: MessageFlags.Ephemeral
        });
    } catch (err) {
        console.error(format(lang.manualBanError, { error: err.message }));
        return interaction.reply({
            content: format(lang.manualBanError, { error: err.message }),
            flags: MessageFlags.Ephemeral
        }).catch(() => {});
    }
}
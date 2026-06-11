import { MessageFlags } from 'discord.js';
import lang from '../../configs/lang.js';
import { format } from '../../utils/formatLang.js';
import { userDataManager } from '../../utils/userDataManager.js';

export async function deleteBanDataCommand(interaction) {
    try {
        if (!interaction.memberPermissions?.has('Administrator')) {
            return interaction.reply({
                content: lang.deleteBanDataNoPermission,
                flags: MessageFlags.Ephemeral
            });
        }

        const user = interaction.options.getUser('user');
        const result = userDataManager.deleteUserData(user);

        return interaction.reply({
            content: format(lang.deleteBanDataSuccess, {
                user: `<@${user.id}>`,
                total: result.total,
                bannedRecords: result.bannedRecords,
                whitelistRecords: result.whitelistRecords,
                adminRecords: result.adminRecords,
                farmDataRecords: result.farmDataRecords,
                farmServerRecords: result.farmServerRecords
            }),
            flags: MessageFlags.Ephemeral
        });
    } catch (err) {
        console.error(format(lang.deleteBanDataError, { error: err.message }));

        return interaction.reply({
            content: format(lang.deleteBanDataError, { error: err.message }),
            flags: MessageFlags.Ephemeral
        }).catch(() => {});
    }
}

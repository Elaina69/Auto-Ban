import { MessageFlags, EmbedBuilder } from 'discord.js';
import lang from '../../configs/lang.js';

export async function helpCommand(interaction) {
    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(lang.helpTitle)
        .setDescription(lang.helpDescription)
        .addFields(
            {
                name: lang.helpSetupName,
                value: lang.helpSetupValue,
                inline: false
            },
            {
                name: lang.helpCheckPermName,
                value: lang.helpCheckPermValue,
                inline: false
            },
            {
                name: lang.helpBanListName,
                value: lang.helpBanListValue,
                inline: false
            },
            {
                name: lang.helpAddAdminName,
                value: lang.helpAddAdminValue,
                inline: false
            },
            {
                name: lang.helpDeleteAdminName,
                value: lang.helpDeleteAdminValue,
                inline: false
            },
            {
                name: lang.helpAdminListName,
                value: lang.helpAdminListValue,
                inline: false
            },
            {
                name: lang.helpGetBanInfoName,
                value: lang.helpGetBanInfoValue,
                inline: false
            },
            {
                name: lang.helpBanTestName,
                value: lang.helpBanTestValue,
                inline: false
            }
        )
        .setTimestamp();

    await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
    });
}

import lang from '../../configs/lang.js';
import { format } from '../../utils/formatLang.js';
import { MessageFlags, PermissionFlagsBits } from 'discord.js';

export async function checkPermCommand(interaction) {
    // Get the channel to check permissions, default to current channel if not provided
    let channel = interaction.options.getChannel('channel') || interaction.channel;

    // Get the bot's permissions in that channel
    const permissions = channel.permissionsFor(interaction.client.user);

    // List of permissions to check
    const requiredPerms = [
        { name: lang.permViewChannel, perm: PermissionFlagsBits.ViewChannel },
        { name: lang.permSendMessages, perm: PermissionFlagsBits.SendMessages },
        { name: lang.permReadMessageHistory, perm: PermissionFlagsBits.ReadMessageHistory },
        { name: lang.permAddReactions, perm: PermissionFlagsBits.AddReactions },
        { name: lang.permManageMessages, perm: PermissionFlagsBits.ManageMessages },
        { name: lang.permBanMembers, perm: PermissionFlagsBits.BanMembers }
    ];

    let result = format(lang.botPermissionInChannel, { channel: channel }) + '\n';
    for (const p of requiredPerms) {
        result += `- ${p.name}: ${permissions.has(p.perm) ? '✅' : '❌'}\n`;
    }

    await interaction.reply({
        content: result,
        flags: MessageFlags.Ephemeral
    });
}
import { MessageFlags, ChannelType } from 'discord.js';
import lang from '../../configs/lang.js';
import { configManager } from '../../utils/configManager.js';
import handleMessageCreate from '../messageCreate.js';

export async function banTestCommand(interaction) {
    const botConfig = await configManager.loadBotConfig();
    const bannedAccounts = await configManager.loadBannedAccounts();
    const serverConfig = await configManager.loadServerConfig();

    const mode = interaction.options.getString('mode') || 'normal';
    await interaction.deferReply({
        flags: MessageFlags.Ephemeral
    });

    const guild = interaction.guild;
    const user = interaction.user;
    const client = interaction.client;

    // Simulated message for testing
    const fakeMessage = {
        author: user,
        guild,
        channel: interaction.channel,
        content: 'Test spam message',
        attachments: new Map(),
        createdTimestamp: Date.now(),
        async delete() {}
    };

    if (mode === 'normal') {
        await interaction.editReply(lang.testingAutoBan);
        await handleMessageCreate(fakeMessage, serverConfig, bannedAccounts, botConfig, client);
        await interaction.followUp({ 
            content: lang.testNormalModeDone, 
            flags: MessageFlags.Ephemeral
        });
    }

    if (mode === 'multichannel') {
        await interaction.editReply(lang.testingMultiChannelSpam);
        const channels = guild.channels.cache.filter(
            ch => ch.type === ChannelType.GuildText &&
                ch.viewable &&
                ch.permissionsFor(client.user)?.has('SendMessages')
        ).first(3);

        if (channels.length < 3) {
            await interaction.followUp(lang.needAtLeast3Channels);
            return;
        }

        for (const ch of channels) {
            const fakeSpamMsg = { ...fakeMessage, channel: ch, content: 'Spam test message' };
            await handleMessageCreate(fakeSpamMsg, serverConfig, bannedAccounts, botConfig, client);
        }

        await interaction.followUp({ 
            content: lang.testMultiChannelDone,
            flags: MessageFlags.Ephemeral
        });
    }
}
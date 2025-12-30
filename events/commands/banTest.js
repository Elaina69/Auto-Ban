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
        async delete() {},
        async reply(content) {
            // Mock reply method for testing
            return {
                delete: async () => {}
            };
        }
    };

    if (mode === 'normal') {
        await interaction.editReply(lang.testingAutoBan);
        
        // Get the banned channel from server config
        const guildSettings = serverConfig[guild.id];
        if (!guildSettings || !guildSettings.bannedChannelId) {
            await interaction.followUp({
                content: lang.noBannedChannelSetup,
                flags: MessageFlags.Ephemeral
            });
            return;
        }
        
        // Get the banned channel
        const bannedChannel = await guild.channels.fetch(guildSettings.bannedChannelId);
        if (!bannedChannel) {
            await interaction.followUp({
                content: lang.bannedChannelNotFound,
                flags: MessageFlags.Ephemeral
            });
            return;
        }
        
        // Update fake message to use banned channel
        fakeMessage.channel = bannedChannel;
        
        await handleMessageCreate(fakeMessage, client);
        await interaction.followUp({ 
            content: lang.testNormalModeDone, 
            flags: MessageFlags.Ephemeral
        });
    }

    const channelSpamThreshold = botConfig.channelSpamThreshold || 3;
    if (mode === 'multichannel') {
        await interaction.editReply(lang.testingMultiChannelSpam);
        const channels = guild.channels.cache.filter(
            ch => ch.type === ChannelType.GuildText &&
                ch.viewable &&
                ch.permissionsFor(client.user)?.has('SendMessages')
        ).first(channelSpamThreshold);

        if (channels.length < channelSpamThreshold) {
            await interaction.followUp({
                content: lang.needAtLeast3Channels,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // Send spam messages to multiple channels with the same content
        const spamContent = 'ᓚᘏᗢ';
        for (const ch of channels) {
            const fakeSpamMsg = { ...fakeMessage, channel: ch, content: spamContent };
            await handleMessageCreate(fakeSpamMsg, client);
            // Small delay to ensure messages are processed in order
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        await interaction.followUp({ 
            content: lang.testMultiChannelDone,
            flags: MessageFlags.Ephemeral
        });
    }
}
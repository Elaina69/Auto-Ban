import { REST, Routes, SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import lang from '../configs/lang.js';

/**
 * Registers the bot commands with the Discord API.
 * @param {string} token - The bot token.
 * @param {string} botId - The bot ID.
 */
export async function registerCommands(token, botId) {
    const commands = [
        // Command: /help
        new SlashCommandBuilder()
            .setName('help')
            .setDescription(lang.helpCommandDescription),
        // Command: /setup (channel to ban) (channel to notify)
        new SlashCommandBuilder()
            .setName('setup')
            .setDescription(lang.setupDescription)
            .addChannelOption(option =>
                option.setName('channeltoban')
                    .setDescription(lang.setupChannelToBanDescription)
                    .setRequired(true)
                    .addChannelTypes(ChannelType.GuildText)
            )
            .addChannelOption(option =>
                option.setName('notifychannel')
                    .setDescription(lang.setupNotifyChannelDescription)
                    .setRequired(false)
                    .addChannelTypes(ChannelType.GuildText)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        // Command: /banlist
        new SlashCommandBuilder()
            .setName('banlist')
            .setDescription(lang.bannedListDescription),

        // Command: /checkperm
        new SlashCommandBuilder()
            .setName('checkperm')
            .setDescription(lang.checkBotPermissionDescription)
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription(lang.checkBotPermissionChannelDesc)
                    .setRequired(false)
                    .addChannelTypes(ChannelType.GuildText)
            ),
        // Command: /bantest
        new SlashCommandBuilder()
            .setName('bantest')
            .setDescription('Test the auto-ban functionality.')
            .addStringOption(option =>
                option
                    .setName('mode')
                    .setDescription('Select test mode (normal or multichannel)')
                    .setRequired(false)
                    .addChoices(
                        { name: 'normal', value: 'normal' },
                        { name: 'multichannel', value: 'multichannel' }
                    )
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        // Command: /addAdmin
        new SlashCommandBuilder()
            .setName('addadmin')
            .setDescription("Add admin/mod's name to the list for ban message.")
            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription("User to be added as admin/mod")
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        // Command: /deleteAdmin
        new SlashCommandBuilder()
            .setName('deleteadmin')
            .setDescription("Delete admin/mod's name from the list for ban message.")
            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription("User to be removed from admin/mod list")
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        // Command: /adminlist
        new SlashCommandBuilder()
            .setName('adminlist')
            .setDescription('List all admins/moderators for the server.')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        // Command: /getBanInfo
        new SlashCommandBuilder()
            .setName('getbaninfo')
            .setDescription(lang.getBanInfoDescription)
            .addStringOption(option =>
                option
                    .setName('username')
                    .setDescription(lang.getBanInfoUsernameDescription)
                    .setRequired(true)
            )
    ].map(cmd => cmd.toJSON());

    // Register slash commands globally
    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log(lang.registeringCommands);
        await rest.put(Routes.applicationCommands(botId), { body: commands });
        console.log(lang.commandRegistered);
    } 
    catch (err) {
        console.error(lang.commandRegisterError, err);
    }
}
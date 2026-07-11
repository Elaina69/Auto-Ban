import { REST, Routes, SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import lang from '../configs/lang.js';
import { getAllCropNames } from '../utils/cropManager.js';

const cropChoices = getAllCropNames().map(name => ({ name, value: name }));
const cropOrAllChoices = [{ name: 'all', value: 'all' }, ...cropChoices];
const cropSortChoices = [
    { name: 'name', value: 'name' },
    { name: 'buy', value: 'buy' },
    { name: 'sell', value: 'sell' },
    { name: 'time', value: 'time' },
    { name: 'yield', value: 'yield' }
];

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
        // Command: /getbanlist
        new SlashCommandBuilder()
            .setName('getbanlist')
            .setDescription(lang.bannedListDescription)
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

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
        // Command: /addadmin
        new SlashCommandBuilder()
            .setName('addadmin')
            .setDescription(lang.addAdminDescription)
            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription(lang.addAdminUserDescription)
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        // Command: /deleteadmin
        new SlashCommandBuilder()
            .setName('deleteadmin')
            .setDescription(lang.deleteAdminDescription)
            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription(lang.deleteAdminUserDescription)
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        // Command: /getadminlist
        new SlashCommandBuilder()
            .setName('getadminlist')
            .setDescription(lang.getAdminListDescription)
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        // Command: /addwhitelist
        new SlashCommandBuilder()
            .setName('addwhitelist')
            .setDescription(lang.addWhitelistDescription)
            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription(lang.addWhitelistUserDescription)
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        // Command: /deletewhitelist
        new SlashCommandBuilder()
            .setName('deletewhitelist')
            .setDescription(lang.deleteWhitelistDescription)
            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription(lang.deleteWhitelistUserDescription)
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        // Command: /getwhitelist
        new SlashCommandBuilder()
            .setName('getwhitelist')
            .setDescription(lang.getWhitelistDescription)
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        // Command: /ban
        new SlashCommandBuilder()
            .setName('ban')
            .setDescription(lang.manualBanDescription)
            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription(lang.manualBanUserDescription)
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        // Command: /unban
        new SlashCommandBuilder()
            .setName('unban')
            .setDescription(lang.manualUnbanDescription)
            .addStringOption(option =>
                option
                    .setName('username')
                    .setDescription(lang.manualUnbanUsernameDescription)
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        // Command: /getbaninfo
        new SlashCommandBuilder()
            .setName('getbaninfo')
            .setDescription(lang.getBanInfoDescription)
            .addStringOption(option =>
                option
                    .setName('username')
                    .setDescription(lang.getBanInfoUsernameDescription)
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        // Command: /deletebandata
        new SlashCommandBuilder()
            .setName('deletebandata')
            .setDescription(lang.deleteBanDataDescription)
            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription(lang.deleteBanDataUserDescription)
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder()
            .setName('raid')
            .setDescription('Configure and inspect join-raid protection')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('setup')
                    .setDescription('Enable or update raid protection')
                    .addStringOption(option => option
                        .setName('mode')
                        .setDescription('Action mode for detected raids')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Alert only', value: 'alert' },
                            { name: 'Quarantine', value: 'quarantine' },
                            { name: 'Enforce', value: 'enforce' }
                        ))
                    .addChannelOption(option => option
                        .setName('notifychannel')
                        .setDescription('Channel for raid alerts')
                        .addChannelTypes(ChannelType.GuildText))
                    .addRoleOption(option => option
                        .setName('quarantinerole')
                        .setDescription('Role applied to members in an active raid cohort'))
                    .addRoleOption(option => option
                        .setName('protectedrole')
                        .setDescription('Role blocked from new raid-cohort members'))
                    .addIntegerOption(option => option
                        .setName('jointhreshold')
                        .setDescription('Joins needed to open an incident')
                        .setMinValue(3)
                        .setMaxValue(100))
                    .addIntegerOption(option => option
                        .setName('joinwindow')
                        .setDescription('Join burst window in seconds')
                        .setMinValue(10)
                        .setMaxValue(600))
                    .addIntegerOption(option => option
                        .setName('campaignaccounts')
                        .setDescription('Distinct cohort accounts for a campaign')
                        .setMinValue(2)
                        .setMaxValue(20))
                    .addIntegerOption(option => option
                        .setName('campaignchannels')
                        .setDescription('Distinct channels for a campaign')
                        .setMinValue(2)
                        .setMaxValue(20))
                    .addIntegerOption(option => option
                        .setName('campaignwindow')
                        .setDescription('Campaign correlation window in seconds')
                        .setMinValue(10)
                        .setMaxValue(600))
                    .addIntegerOption(option => option
                        .setName('newaccountdays')
                        .setDescription('Age in days counted as a new account (context only)')
                        .setMinValue(0)
                        .setMaxValue(365))
                    .addIntegerOption(option => option
                        .setName('retentiondays')
                        .setDescription('Encrypted incident retention in days')
                        .setMinValue(1)
                        .setMaxValue(90))
                    .addBooleanOption(option => option
                        .setName('releaseafterscreening')
                        .setDescription('Remove quarantine after membership screening'))
            )
            .addSubcommand(subcommand => subcommand
                .setName('disable')
                .setDescription('Disable raid protection and close the active incident'))
            .addSubcommand(subcommand => subcommand
                .setName('status')
                .setDescription('Show raid protection configuration and active state'))
            .addSubcommand(subcommand => subcommand
                .setName('incidents')
                .setDescription('Show the five most recent retained incidents'))
            .addSubcommand(subcommand => subcommand
                .setName('test')
                .setDescription('Send a safe raid alert without modifying members'))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder()
            .setName('privacy')
            .setDescription('Show how Auto-Ban processes and retains data'),
        // Command: /farm (slash-only minigame commands)
        new SlashCommandBuilder()
            .setName('farm')
            .setDescription('Farming minigame commands')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('enable')
                    .setDescription('Enable farming mode')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('disable')
                    .setDescription('Disable farming mode')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('help')
                    .setDescription('Show farming help')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('login')
                    .setDescription('Claim your daily farming reward')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('status')
                    .setDescription('View your farm or another player farm')
                    .addUserOption(option =>
                        option
                            .setName('user')
                            .setDescription('Player to inspect')
                            .setRequired(false)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('grow')
                    .setDescription('Plant a crop on all land slots')
                    .addStringOption(option =>
                        option
                            .setName('crop')
                            .setDescription('Crop to plant')
                            .setRequired(true)
                            .addChoices(...cropChoices)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('harvest')
                    .setDescription('Harvest mature crops')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('sell')
                    .setDescription('Sell crops from your inventory')
                    .addStringOption(option =>
                        option
                            .setName('crop')
                            .setDescription('Crop to sell, or all')
                            .setRequired(true)
                            .addChoices(...cropOrAllChoices)
                    )
                    .addStringOption(option =>
                        option
                            .setName('amount')
                            .setDescription('Amount to sell, or all')
                            .setRequired(false)
                            .setMaxLength(16)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('buy')
                    .setDescription('Buy crop inventory at current market price')
                    .addStringOption(option =>
                        option
                            .setName('crop')
                            .setDescription('Crop to buy')
                            .setRequired(true)
                            .addChoices(...cropChoices)
                    )
                    .addStringOption(option =>
                        option
                            .setName('quantity')
                            .setDescription('Quantity to buy, or all')
                            .setRequired(false)
                            .setMaxLength(16)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('expand')
                    .setDescription('Buy one additional land slot')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('crops')
                    .setDescription('List crops and current market prices')
                    .addStringOption(option =>
                        option
                            .setName('sort')
                            .setDescription('Sort crop list')
                            .setRequired(false)
                            .addChoices(...cropSortChoices)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('info')
                    .setDescription('Show detailed crop market information')
                    .addStringOption(option =>
                        option
                            .setName('crop')
                            .setDescription('Crop to inspect, or all')
                            .setRequired(false)
                            .addChoices(...cropOrAllChoices)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('role-list')
                    .setDescription('Show farm role shop items')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('role-buy')
                    .setDescription('Buy a configured farm role')
                    .addRoleOption(option =>
                        option
                            .setName('role')
                            .setDescription('Role to buy from the farm shop')
                            .setRequired(true)
                    )
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

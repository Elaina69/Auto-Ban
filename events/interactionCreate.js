import { MessageFlags } from "discord.js";
import { helpCommand } from './commands/help.js';
import { setupCommand } from './commands/setup.js';
import { banListCommand } from './commands/banList.js';
import { checkPermCommand } from './commands/checkPerm.js';
import { banTestCommand } from './commands/banTest.js';
import { addAdminCommand } from './commands/addAdmin.js';
import { deleteAdminCommand } from './commands/deleteAdmin.js';
import { adminList } from './commands/adminList.js';
import { addWhitelistCommand } from './commands/addWhitelist.js';
import { deleteWhitelistCommand } from './commands/deleteWhitelist.js';
import { getWhitelistCommand } from './commands/getWhitelist.js';
import { banCommand } from './commands/ban.js';
import { unbanCommand } from './commands/unban.js';
import { getBanInfoCommand } from './commands/getBanInfo.js';
import { deleteBanDataCommand } from './commands/deleteBanData.js';
// Farm commands
import { farmEnableCommand } from './commands/farm/enable.js';
import { farmPrefixCommand } from './commands/farm/prefix.js';

export class HandleInteractionCreate {
    /**
     * Add slash commands.
     * @param {import('discord.js').Interaction} interaction - The interaction object.
     */
    createCommandsInteraction = async (interaction) => {
        // Check if the interaction is a chat input command
        if (!interaction.isChatInputCommand()) return;

        switch (interaction.commandName) {
            // Command: /help
            case 'help':
                await helpCommand(interaction);
                break;
            // Command: /setup (channel to ban) (channel to notify)
            case 'setup':
                await setupCommand(interaction);
                break;
            // Command: /getbanlist
            case 'getbanlist':
                await banListCommand(interaction);
                break;
            // Command: /checkperm (channel)
            case 'checkperm':
                await checkPermCommand(interaction);
                break;
             // Command: /bantest
            case 'bantest':
                await banTestCommand(interaction);
                break;
            // Command: /addadmin (user)
            case 'addadmin':
                await addAdminCommand(interaction);
                break;
            // Command: /deleteadmin (user)
            case 'deleteadmin':
                await deleteAdminCommand(interaction);
                break;
            // Command: /getadminlist
            case 'getadminlist':
                await adminList(interaction);
                break;
            // Command: /addwhitelist (user)
            case 'addwhitelist':
                await addWhitelistCommand(interaction);
                break;
            // Command: /deletewhitelist (user)
            case 'deletewhitelist':
                await deleteWhitelistCommand(interaction);
                break;
            // Command: /getwhitelist
            case 'getwhitelist':
                await getWhitelistCommand(interaction);
                break;
            // Command: /ban (user)
            case 'ban':
                await banCommand(interaction);
                break;
            // Command: /unban (username)
            case 'unban':
                await unbanCommand(interaction);
                break;
            // Command: /getbaninfo (username)
            case 'getbaninfo':
                await getBanInfoCommand(interaction);
                break;
            // Command: /deletebandata (user)
            case 'deletebandata':
                await deleteBanDataCommand(interaction);
                break;
            // Command: /farm (subcommands)
            case 'farm':
                const subcommand = interaction.options.getSubcommand();
                switch (subcommand) {
                    case 'enable':
                        await farmEnableCommand(interaction, 'enable');
                        break;
                    case 'disable':
                        await farmEnableCommand(interaction, 'disable');
                        break;
                    case 'prefix':
                        await farmPrefixCommand(interaction);
                        break;
                    default:
                        await interaction.reply({
                            content: 'Unknown farm subcommand.',
                            flags: MessageFlags.Ephemeral
                        });
                }
                break;
            default:
                await interaction.reply({
                    content: 'Unknown command.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
        }
    }
}

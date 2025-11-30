import { MessageFlags } from "discord.js";
import { setupCommand } from './commands/setup.js';
import { banListCommand } from './commands/banList.js';
import { checkPermCommand } from './commands/checkPerm.js';
import { banTestCommand } from './commands/banTest.js';
import { addAdminCommand } from './commands/addAdmin.js';
import { deleteAdminCommand } from './commands/deleteAdmin.js';
import { adminList } from './commands/adminList.js';

export class HandleInteractionCreate {
    /**
     * Add slash commands.
     * @param {import('discord.js').Interaction} interaction - The interaction object.
     */
    createCommandsInteraction = async (interaction) => {
        // Check if the interaction is a chat input command
        if (!interaction.isChatInputCommand()) return;

        switch (interaction.commandName) {
            // Command: /setup (channel to ban) (channel to notify)
            case 'setup':
                await setupCommand(interaction);
                break;
            // Command: /banlist
            case 'banlist':
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
            // Command: /adminlist
            case 'adminlist':
                await adminList(interaction);
                break;
            default:
                await interaction.reply({
                    content: 'Unknown command.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
        }
    }
}
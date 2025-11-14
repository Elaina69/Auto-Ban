import { setupCommand } from './commands/setup.js';
import { banListCommand } from './commands/banList.js';
import { checkPermCommand } from './commands/checkPerm.js';
import { banTestCommand } from './commands/banTest.js';

export class HandleInteractionCreate {
    /**
     * Add slash commands.
     * @param {import('discord.js').Interaction} interaction - The interaction object.
     */
    createCommandsInteraction = async (interaction) => {
        // Check if the interaction is a chat input command
        if (!interaction.isChatInputCommand()) return;

        // Command: /setup (channel to ban) (channel to notify)
        if (interaction.commandName === 'setup') await setupCommand(interaction);
        // Command: /banlist
        if (interaction.commandName === 'banlist') await banListCommand(interaction);
        // Command: /checkperm
        if (interaction.commandName === 'checkperm') await checkPermCommand(interaction);
        // Command: /bantest
        if (interaction.commandName === 'bantest') await banTestCommand(interaction)
    }
}
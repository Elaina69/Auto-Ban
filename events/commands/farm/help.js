import { EmbedBuilder } from 'discord.js';
import { farmManager } from '../../../utils/farmManager.js';

export async function handleFarmHelp(message) {
    const prefix = farmManager.getServerPrefix(message.guild.id);
    
    const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🌾 Farming System - Help')
        .setDescription('Here are the commands you can use:')
        .addFields(
            {
                name: `💰 \`${prefix}login\``,
                value: 'Receive $10,000 daily (resets at 00:00 UTC+7)',
                inline: false
            },
            {
                name: `📊 \`${prefix}status [user]\``,
                value: 'View your farm info or another player\'s farm (mention or username)',
                inline: false
            },
            {
                name: `🌱 \`${prefix}grow <crop name>\``,
                value: `Plant crops on all land slots.`,
                inline: false
            },
            {
                name: `🌾 \`${prefix}harvest\``,
                value: 'Harvest mature crops. Note: 10% yield loss per hour overdue!',
                inline: false
            },
            {
                name: `💵 \`${prefix}sell <crop name|all> <amount|all>\``,
                value: `Sell crops from inventory. Specify amount or use \`all\` to sell everything`,
                inline: false
            },
            {
                name: `🛒 \`${prefix}buy <crop name> [amount|all]\``,
                value: `Buy crops at today's market price. Use \`all\` to spend all your money`,
                inline: false
            },
            {
                name: `🏗️ \`${prefix}expand\``,
                value: 'Expand your farm (max 100 land slots)',
                inline: false
            },
            {
                name: `📋 \`${prefix}crop [crop name|list] [sort]\``,
                value: `• No args or \`list\` - View all crops\n• \`<crop name>\` - View specific crop info\nSort: \`name\`, \`buy\`, \`sell\`, \`time\`, \`yield\``,
                inline: false
            },
            {
                name: `🏪 \`${prefix}role list\` & \`${prefix}role buy <role>\``,
                value: 'View and purchase roles (if enabled in this server)',
                inline: false
            }
        )
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

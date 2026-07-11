import { EmbedBuilder } from 'discord.js';

export async function handleFarmHelp(message) {
    const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🌾 Farming System - Help')
        .setDescription('Use these slash commands to manage your farm:')
        .addFields(
            {
                name: '💰 `/farm login`',
                value: 'Receive $10,000 daily (resets at 00:00 UTC+7)',
                inline: false
            },
            {
                name: '📊 `/farm status [user]`',
                value: 'View your farm info or another player\'s farm',
                inline: false
            },
            {
                name: '🌱 `/farm grow crop:<crop>`',
                value: 'Plant crops on all land slots.',
                inline: false
            },
            {
                name: '🌾 `/farm harvest`',
                value: 'Harvest mature crops. Note: 10% yield loss per hour overdue!',
                inline: false
            },
            {
                name: '💵 `/farm sell crop:<crop|all> amount:<amount|all>`',
                value: 'Sell crops from inventory. Specify amount or use `all` to sell everything',
                inline: false
            },
            {
                name: '🛒 `/farm buy crop:<crop> quantity:<amount|all>`',
                value: 'Buy crops at today\'s market price. Use `all` to spend all your money',
                inline: false
            },
            {
                name: '🏗️ `/farm expand`',
                value: 'Expand your farm (max 100 land slots)',
                inline: false
            },
            {
                name: '📋 `/farm crops` and `/farm info`',
                value: 'List all crops, sort prices, or view detailed crop information.',
                inline: false
            },
            {
                name: '🏪 `/farm role-list` and `/farm role-buy role:<role>`',
                value: 'View and purchase roles (if enabled in this server)',
                inline: false
            }
        )
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

import { EmbedBuilder } from 'discord.js';
import { farmManager } from '../../../utils/farmManager.js';
import { getCrop } from '../../../utils/cropManager.js';

export async function handleFarmSell(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    const prefix = farmManager.getServerPrefix(guildId);
    
    // Parse cropName and amount from args
    let cropName = args[0];
    let amount = args[1] || 'all';
    
    if (!cropName) {
        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Error')
            .setDescription(`Please specify a crop name or \`all\`!\n\n💡 **Examples:**\n\`${prefix}sell tomato 50\` - sell 50 tomatoes\n\`${prefix}sell tomato all\` - sell all tomatoes\n\`${prefix}sell all\` - sell all crops`)
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    const userFarm = farmManager.getUserFarm(userId, guildId);
    
    // Check if inventory is empty
    const hasItems = Object.values(userFarm.inventory).some(amount => amount > 0);
    if (!hasItems) {
        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Empty Inventory')
            .setDescription('Your inventory is empty!\n\n💡 Harvest crops before selling.')
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Sell all crops
    if (cropName.toLowerCase() === 'all') {
        const result = farmManager.sellCrop(userId, guildId, 'all', 'all');
        
        if (!result) {
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ Nothing to Sell')
                .setTimestamp();
            await message.reply({ embeds: [embed] });
            return;
        }
        
        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('✅ Sold All Crops!')
            .addFields(
                { name: '📦 Total Amount', value: `${result.amount} units`, inline: true },
                { name: '💰 Money Received', value: `$${result.totalPrice.toLocaleString()}`, inline: true },
                { name: '💵 Current Balance', value: `$${(userFarm.money + result.totalPrice).toLocaleString()}`, inline: true }
            )
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Sell specific crop
    const crop = getCrop(cropName);
    if (!crop) {
        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Crop Not Found')
            .setDescription(`Crop **${cropName}** not found.\n\n💡 Use \`${prefix}info all\` to see available crops.`)
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    const inventoryAmount = userFarm.inventory[crop.name] || 0;
    if (inventoryAmount === 0) {
        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Not in Inventory')
            .setDescription(`You don't have any **${crop.displayName}** in inventory!\n\n💡 Use \`${prefix}status\` to check your inventory.`)
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Validate amount parameter
    let sellAmount = amount;
    if (amount !== 'all') {
        const parsedAmount = parseInt(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ Invalid Amount')
                .setDescription('Please enter a positive number or `all`.')
                .setTimestamp();
            await message.reply({ embeds: [embed] });
            return;
        }
        sellAmount = parsedAmount;
        
        if (parsedAmount > inventoryAmount) {
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ Insufficient Inventory')
                .setDescription(`You only have **${inventoryAmount}** ${crop.displayName} in inventory!`)
                .setTimestamp();
            await message.reply({ embeds: [embed] });
            return;
        }
    }
    
    const result = farmManager.sellCrop(userId, guildId, crop.name, sellAmount);
    
    if (!result) {
        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Error')
            .setDescription('An error occurred while selling. Please try again.')
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`✅ Sold ${crop.displayName}!`)
        .addFields(
            { name: '📦 Amount', value: `${result.amount} units`, inline: true },
            { name: '💰 Money Received', value: `$${result.totalPrice.toLocaleString()}`, inline: true },
            { name: '💵 Current Balance', value: `$${(userFarm.money + result.totalPrice).toLocaleString()}`, inline: true }
        )
        .setTimestamp();
    await message.reply({ embeds: [embed] });
}

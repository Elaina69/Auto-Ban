import { EmbedBuilder } from 'discord.js';
import { farmManager } from '../../../utils/farmManager.js';
import { getCrop, formatTime, getDailyBuyPrice, getDailySellPrice } from '../../../utils/cropManager.js';

export async function handleFarmGrow(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    const cropName = args.join(' ');
    const prefix = farmManager.getServerPrefix(guildId);
    
    if (!cropName) {
        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Error')
            .setDescription(`Please specify a crop name!\n\n💡 Example: \`${prefix}grow tomato\``)
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Get crop data
    const crop = getCrop(cropName);
    if (!crop) {
        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Crop Not Found')
            .setDescription(`Crop **${cropName}** not found.\n\n💡 Use \`${prefix}info <crop name>\` to see available crops.`)
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    const userFarm = farmManager.getUserFarm(userId, guildId);
    
    // Check if already growing something
    if (userFarm.currentCrop) {
        const embed = new EmbedBuilder()
            .setColor(0xff9900)
            .setTitle('⚠️ Already Growing')
            .setDescription(`You're already growing **${userFarm.currentCrop.displayName}**!\n\n💡 Harvest first before planting new crops.\nUse \`${prefix}harvest\``)
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Calculate total cost using today's buy price
    const buyPrice = getDailyBuyPrice(crop.name);
    const totalCost = buyPrice * userFarm.landSlots;
    
    // Check if user has enough money
    if (userFarm.money < totalCost) {
        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Insufficient Funds')
            .addFields(
                { name: '💰 Need', value: `$${totalCost.toLocaleString()}`, inline: true },
                { name: '💵 You Have', value: `$${userFarm.money.toLocaleString()}`, inline: true },
                { name: '💡 Short', value: `$${(totalCost - userFarm.money).toLocaleString()}`, inline: true }
            )
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Plant the crop
    const success = farmManager.plantCrop(userId, guildId, crop);
    
    if (!success) {
        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Error')
            .setDescription('An error occurred while planting. Please try again.')
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    const expectedYield = crop.yield * userFarm.landSlots;
    const sellPrice = getDailySellPrice(crop.name);
    const expectedValue = expectedYield * sellPrice;
    const netProfit = expectedValue - totalCost;
    
    const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`✅ Planted ${crop.displayName}!`)
        .addFields(
            { name: '🏗️ Land Slots', value: `${userFarm.landSlots}`, inline: true },
            { name: '💰 Total Cost', value: `$${totalCost.toLocaleString()}`, inline: true },
            { name: '⏰ Growth Time', value: formatTime(crop.growthTime), inline: true },
            { name: '🌾 Expected Yield', value: `${expectedYield} units`, inline: true },
            { name: '💵 Expected Value', value: `$${expectedValue.toLocaleString()}`, inline: true },
            { name: '💰 Net Profit', value: `$${netProfit.toLocaleString()}`, inline: true },
            { name: "💸 Buy Price", value: `$${buyPrice}/unit`, inline: true },
            { name: "💰 Sell Price", value: `$${sellPrice}/unit`, inline: true },
            { name: '\u200b', value: '\u200b', inline: true }
        )
        .setFooter({ text: '⚠️ 10% yield loss per hour overdue!' })
        .setTimestamp();
    await message.reply({ embeds: [embed] });
}

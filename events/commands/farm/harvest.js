import { EmbedBuilder } from 'discord.js';
import { farmManager } from '../../../utils/farmManager.js';
import { formatTime, getDailySellPrice } from '../../../utils/cropManager.js';

export async function handleFarmHarvest(message) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const userFarm = farmManager.getUserFarm(userId, guildId);
    const cropStatus = farmManager.getCropStatus(userId, guildId);
    const prefix = farmManager.getServerPrefix(guildId);
    
    // Check if there's a crop planted
    if (!userFarm.currentCrop) {
        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ No Crops Planted')
            .setDescription(`You haven't planted any crops!\n\n💡 Use \`${prefix}grow <crop name>\` to start planting.`)
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Check if crop is ready
    if (!cropStatus.ready) {
        const embed = new EmbedBuilder()
            .setColor(0xff9900)
            .setTitle(`⏰ ${userFarm.currentCrop.displayName} is Not Ready`)
            .setDescription(`⏳ Time remaining: **${formatTime(cropStatus.timeLeft)}**`)
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Harvest the crop
    const result = farmManager.harvestCrop(userId, guildId);
    
    if (!result) {
        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Error')
            .setDescription('An error occurred while harvesting. Please try again.')
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    const { crop, yield: actualYield, penalty, experience } = result;
    const penaltyPercent = Math.round((1 - penalty) * 100);
    const dailyPrice = getDailySellPrice(crop.name);
    const cropValue = actualYield * dailyPrice;
    
    const embed = new EmbedBuilder()
        .setColor(penaltyPercent > 0 ? 0xff9900 : 0x00ff00)
        .setTitle('✅ Harvest Successful!')
        .addFields(
            { name: '🌾 Crop', value: crop.displayName, inline: true },
            { name: '📦 Harvested', value: `${actualYield} units`, inline: true },
            { name: '⭐ Experience', value: `+${experience} EXP`, inline: true },
            { name: '💵 Value', value: `$${cropValue.toLocaleString()}`, inline: true },
            { name: "💰 Today's Price", value: `$${dailyPrice}/unit`, inline: true },
            { name: '\u200b', value: '\u200b', inline: true }
        );
    
    if (penaltyPercent > 0) {
        embed.addFields(
            { name: '⚠️ Overdue By', value: formatTime(cropStatus.overdue), inline: true },
            { name: '📉 Yield Loss', value: `${penaltyPercent}%`, inline: true }
        );
        embed.setDescription('💡 Harvest on time next time!');
    } else {
        embed.setDescription('🎉 Harvested on time! No yield loss!');
    }
    
    embed.setFooter({ text: `Use ${prefix}sell ${crop.name} to sell this crop` })
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

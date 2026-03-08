import { EmbedBuilder } from 'discord.js';
import { getCrop, getAllCropNames, formatTime, getDailyBuyPrice, getDailySellPrice } from '../../../utils/cropManager.js';
import { crops } from '../../../configs/crops.js';
import { farmManager } from '../../../utils/farmManager.js';
import { priceHistoryManager } from '../../../utils/priceHistoryManager.js';

export async function handleFarmInfo(message, args) {
    const cropName = args.join(' ');
    const prefix = farmManager.getServerPrefix(message.guild.id);
    
    // If no crop specified, show list of all crops with today's prices
    if (!cropName || cropName.toLowerCase() === 'all') {
        const allCrops = getAllCropNames();
        
        // Create array with crop data and daily prices, then sort by sell price descending
        const cropsWithPrices = allCrops.map(name => {
            const crop = getCrop(name);
            const buyPrice = getDailyBuyPrice(crop.name);
            const sellPrice = getDailySellPrice(crop.name);
            return { crop, buyPrice, sellPrice };
        }).sort((a, b) => b.sellPrice - a.sellPrice);
        
        const cropList = cropsWithPrices.map(({ crop, buyPrice, sellPrice }) => {
            return `• ${crop.displayName} - Buy: **$${buyPrice}** | Sell: **$${sellPrice}**`;
        }).join('\n');
        
        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('🌾 Available Crops')
            .setDescription('Here are all the crops you can grow:\n\n' + cropList)
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Get specific crop info
    const crop = getCrop(cropName);
    if (!crop) {
        await message.reply(`❌ Crop **${cropName}** not found.\n💡 Use \`${prefix}crop all\` to see all available crops.`);
        return;
    }
    
    const buyPrice = getDailyBuyPrice(crop.name);
    const sellPrice = getDailySellPrice(crop.name);
    
    // Generate price history chart (use lowercase crop key from getCrop)
    const cropKey = Object.keys(crops).find(key => crops[key].name === crop.name) || crop.name.toLowerCase();
    const chartUrl = priceHistoryManager.generatePriceChart(cropKey, crop.displayName);
    
    const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`${crop.displayName} - Detailed Information`)
        .addFields(
            {
                name: '⏰ Growth Time',
                value: `**${formatTime(crop.growthTime)}**`,
                inline: true
            },
            {
                name: '🌾 Yield',
                value: `**${crop.yield}** units / slot`,
                inline: true
            },
            {
                name: '\u200b',
                value: '\u200b',
                inline: true
            },
            {
                name: '💰 Buy Price Today',
                value: `**$${buyPrice}** / unit`,
                inline: true
            },
            {
                name: '💵 Sell Price Today',
                value: `**$${sellPrice}** / unit`,
                inline: true
            },
            {
                name: '📊 Profit (1 slot)',
                value: `**$${(crop.yield * sellPrice - buyPrice).toLocaleString()}**`,
                inline: true
            }
        )
        .addFields({
            name: '💡 Example with 10 land slots',
            value: `• Buy Cost: **$${(buyPrice * 10).toLocaleString()}**\n` +
                   `• Yield: **${(crop.yield * 10).toLocaleString()}** units\n` +
                   `• Sell Revenue: **$${(crop.yield * sellPrice * 10).toLocaleString()}**\n` +
                   `• Net Profit: **$${((crop.yield * sellPrice - buyPrice) * 10).toLocaleString()}**`,
            inline: false
        })
        .setTimestamp();
    
    // Add chart image if available
    if (chartUrl) {
        embed.setImage(chartUrl);
        embed.setFooter({ text: '📈 Price history updates every 6 hours | Prices change at 00:00, 06:00, 12:00, 18:00 UTC+7' });
    }
    
    await message.reply({ embeds: [embed] });
}

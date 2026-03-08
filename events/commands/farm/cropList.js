import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getAllCropNames, getCrop, formatTime, getDailyBuyPrice, getDailySellPrice } from '../../../utils/cropManager.js';
import { farmManager } from '../../../utils/farmManager.js';

export async function handleCropList(message, args) {
    const prefix = farmManager.getServerPrefix(message.guild.id);
    const allCrops = getAllCropNames();
    
    // Parse sort parameter (default: sell price descending)
    const sortBy = args[0]?.toLowerCase() || 'sell';
    
    // Validate sort parameter
    const validSorts = ['name', 'buy', 'sell', 'time', 'yield'];
    if (!validSorts.includes(sortBy)) {
        const embed = new EmbedBuilder()
            .setColor(0xff9900)
            .setTitle('⚠️ Invalid Sort Option')
            .setDescription(`Please use one of these sort options:\n\n` +
                `• \`${prefix}crop list name\` - Sort by crop name (A-Z)\n` +
                `• \`${prefix}crop list buy\` - Sort by buy price (highest first)\n` +
                `• \`${prefix}crop list sell\` - Sort by sell price (highest first)\n` +
                `• \`${prefix}crop list time\` - Sort by growth time (shortest first)\n` +
                `• \`${prefix}crop list yield\` - Sort by yield (highest first)`)
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Create array with crop data and daily prices
    const cropsWithPrices = allCrops.map(name => {
        const crop = getCrop(name);
        const buyPrice = getDailyBuyPrice(crop.name);
        const sellPrice = getDailySellPrice(crop.name);
        return { crop, buyPrice, sellPrice };
    });
    
    // Sort based on parameter
    switch (sortBy) {
        case 'name':
            cropsWithPrices.sort((a, b) => a.crop.name.localeCompare(b.crop.name));
            break;
        case 'buy':
            cropsWithPrices.sort((a, b) => b.buyPrice - a.buyPrice);
            break;
        case 'sell':
            cropsWithPrices.sort((a, b) => b.sellPrice - a.sellPrice);
            break;
        case 'time':
            cropsWithPrices.sort((a, b) => a.crop.growthTime - b.crop.growthTime);
            break;
        case 'yield':
            cropsWithPrices.sort((a, b) => b.crop.yield - a.crop.yield);
            break;
    }
    
    // Create formatted table with better visual structure
    const cropLines = cropsWithPrices.map(({ crop, buyPrice, sellPrice }, index) => {
        const profit = (crop.yield * sellPrice - buyPrice).toFixed(2);
        const profitIcon = profit > 0 ? '📈' : '📉';
        
        return `\`${String(index + 1).padStart(2, ' ')}.\` ${crop.displayName}\n` +
               `    ⏰ ${formatTime(crop.growthTime)} | 🌾 ${crop.yield} units\n` +
               `    💰 Buy: **$${buyPrice}** | 💵 Sell: **$${sellPrice}** | ${profitIcon} **$${profit}**`;
    });
    
    // Determine sort description
    let sortDescription = '';
    switch (sortBy) {
        case 'name':
            sortDescription = '📝 Sorted by: Name (A-Z)';
            break;
        case 'buy':
            sortDescription = '💰 Sorted by: Buy Price (Highest → Lowest)';
            break;
        case 'sell':
            sortDescription = '💵 Sorted by: Sell Price (Highest → Lowest)';
            break;
        case 'time':
            sortDescription = '⏰ Sorted by: Growth Time (Fastest → Slowest)';
            break;
        case 'yield':
            sortDescription = '🌾 Sorted by: Yield (Highest → Lowest)';
            break;
    }
    
    // Split crops into chunks to avoid Discord embed limits (4096 chars)
    const chunkSize = 10; // 10 crops per embed
    const pages = [];
    
    for (let i = 0; i < cropLines.length; i += chunkSize) {
        const chunk = cropLines.slice(i, i + chunkSize);
        pages.push(chunk);
    }
    
    let currentPage = 0;
    const totalPages = pages.length;
    
    // Function to create embed for current page
    const createEmbed = (page) => {
        return new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle(`🌾 Available Crops (Page ${page + 1}/${totalPages})`)
            .setDescription(`${sortDescription}\n\n${pages[page].join('\n\n')}`)
            .setFooter({ text: `💡 Use ${prefix}crop list <name|buy|sell|time|yield> to sort | Prices update every 6 hours` })
            .setTimestamp();
    };
    
    // Create buttons
    const createButtons = (page) => {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('crop_prev')
                    .setLabel('◀ Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('crop_next')
                    .setLabel('Next ▶')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === totalPages - 1)
            );
    };
    
    // Send initial message
    const response = await message.reply({ 
        embeds: [createEmbed(currentPage)],
        components: totalPages > 1 ? [createButtons(currentPage)] : []
    });
    
    // If only one page, no need for collector
    if (totalPages <= 1) return;
    
    // Create collector for button interactions
    const collector = response.createMessageComponentCollector({
        filter: (i) => i.user.id === message.author.id,
        time: 300000 // 5 minutes
    });
    
    collector.on('collect', async (interaction) => {
        if (interaction.customId === 'crop_prev') {
            currentPage = Math.max(0, currentPage - 1);
        } else if (interaction.customId === 'crop_next') {
            currentPage = Math.min(totalPages - 1, currentPage + 1);
        }
        
        await interaction.update({
            embeds: [createEmbed(currentPage)],
            components: [createButtons(currentPage)]
        });
    });
    
    collector.on('end', () => {
        // Disable buttons after timeout
        response.edit({ components: [] }).catch(() => {});
    });
}

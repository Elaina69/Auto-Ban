import { EmbedBuilder } from 'discord.js';
import { farmManager } from '../../../utils/farmManager.js';
import { getCrop, getDailyBuyPrice } from '../../../utils/cropManager.js';

export async function handleFarmBuy(message, args) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    const prefix = farmManager.getServerPrefix(guildId);
    
    if (args.length === 0) {
        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Error')
            .setDescription(`Please specify a crop name!\n\n💡 **Examples:**\n\`${prefix}buy tomato 10\` - buy 10 units\n\`${prefix}buy tomato all\` - buy with all money`)
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Parse cropName and quantity/all
    let cropName;
    let quantityArg = '1'; // default
    
    if (args.length > 1) {
        quantityArg = args[args.length - 1];
        cropName = args.slice(0, -1).join(' ');
    } else {
        cropName = args.join(' ');
    }
    
    // Get crop data
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
    
    const userFarm = farmManager.getUserFarm(userId, guildId);
    
    // Get today's buy price
    const dailyPrice = getDailyBuyPrice(crop.name);
    
    // Determine quantity to buy
    let buyQuantity;
    if (quantityArg.toLowerCase() === 'all') {
        // Buy as much as possible with all money
        buyQuantity = Math.floor(userFarm.money / dailyPrice);
        
        if (buyQuantity === 0) {
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ Insufficient Funds')
                .setDescription(`Not enough money to buy even 1 unit of **${crop.displayName}**!`)
                .addFields(
                    { name: '💰 Price', value: `$${dailyPrice} / unit`, inline: true },
                    { name: '💵 Your Balance', value: `$${userFarm.money.toLocaleString()}`, inline: true }
                )
                .setTimestamp();
            await message.reply({ embeds: [embed] });
            return;
        }
    } else {
        const quantity = parseInt(quantityArg);
        if (isNaN(quantity) || quantity <= 0) {
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ Invalid Quantity')
                .setDescription('Please enter a positive number or `all`.')
                .setTimestamp();
            await message.reply({ embeds: [embed] });
            return;
        }
        buyQuantity = quantity;
    }
    
    const totalCost = dailyPrice * buyQuantity;
    
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
    
    // Update inventory and money
    const newInventory = { ...userFarm.inventory };
    newInventory[crop.name] = (newInventory[crop.name] || 0) + buyQuantity;
    
    farmManager.updateUserFarm(userId, guildId, {
        money: userFarm.money - totalCost,
        inventory: newInventory
    });
    
    const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`✅ Purchased ${crop.displayName}!`)
        .addFields(
            { name: '📦 Quantity', value: `${buyQuantity} units`, inline: true },
            { name: '💰 Unit Price', value: `$${dailyPrice}`, inline: true },
            { name: '💵 Total Cost', value: `$${totalCost.toLocaleString()}`, inline: true },
            { name: '💰 Remaining Balance', value: `$${(userFarm.money - totalCost).toLocaleString()}`, inline: false }
        )
        .setFooter({ text: "Today's market price" })
        .setTimestamp();
    await message.reply({ embeds: [embed] });
}

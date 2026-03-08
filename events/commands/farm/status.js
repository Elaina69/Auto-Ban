import { EmbedBuilder } from 'discord.js';
import { farmManager } from '../../../utils/farmManager.js';
import { formatTime } from '../../../utils/cropManager.js';

export async function handleFarmStatus(message, args) {
    const guildId = message.guild.id;
    const prefix = farmManager.getServerPrefix(guildId);
    
    // Determine target user
    let targetUser = message.author;
    let userId = message.author.id;
    
    // Check if user specified another player
    if (args.length > 0) {
        // Try to get mentioned user first
        if (message.mentions.users.size > 0) {
            targetUser = message.mentions.users.first();
            userId = targetUser.id;
        } else {
            // Try to find user by username
            const searchName = args.join(' ').toLowerCase();
            const guild = message.guild;
            
            try {
                // Search in guild members
                const members = await guild.members.fetch();
                const foundMember = members.find(member => 
                    member.user.username.toLowerCase() === searchName ||
                    member.user.tag.toLowerCase() === searchName ||
                    member.displayName.toLowerCase() === searchName
                );
                
                if (foundMember) {
                    targetUser = foundMember.user;
                    userId = targetUser.id;
                } else {
                    const embed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('❌ User Not Found')
                        .setDescription(`Cannot find user **${args.join(' ')}**!\n\n💡 Use: \`${prefix}status @user\` or \`${prefix}status username\``)
                        .setTimestamp();
                    await message.reply({ embeds: [embed] });
                    return;
                }
            } catch (error) {
                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle('❌ Error')
                    .setDescription('An error occurred while searching for the user.')
                    .setTimestamp();
                await message.reply({ embeds: [embed] });
                return;
            }
        }
    }
    
    const userFarm = farmManager.getUserFarm(userId, guildId);
    const cropStatus = farmManager.getCropStatus(userId, guildId);
    
    // Build inventory display
    let inventoryDisplay = '';
    if (Object.keys(userFarm.inventory).length === 0 || Object.values(userFarm.inventory).every(v => v === 0)) {
        inventoryDisplay = '*Empty*';
    } else {
        const items = [];
        for (const [cropName, amount] of Object.entries(userFarm.inventory)) {
            if (amount > 0) {
                items.push(`• ${cropName}: **${amount}**`);
            }
        }
        inventoryDisplay = items.join('\n') || '*Empty*';
    }
    
    // Build crop status display
    let cropDisplay = '';
    if (!userFarm.currentCrop) {
        cropDisplay = '*No crops growing*';
    } else {
        const crop = userFarm.currentCrop;
        if (cropStatus.ready) {
            const penalty = farmManager.calculateYieldPenalty(cropStatus.overdue);
            const penaltyPercent = Math.round((1 - penalty) * 100);
            
            if (penaltyPercent > 0) {
                cropDisplay = `🌾 **${crop.displayName}** - ✅ Ready!\n⚠️ Overdue by ${formatTime(cropStatus.overdue)}\n📉 Yield loss: **${penaltyPercent}%**\n💡 Harvest now to prevent more loss!`;
            } else {
                cropDisplay = `🌾 **${crop.displayName}** - ✅ Ready! Harvest now!`;
            }
        } else {
            cropDisplay = `🌱 **${crop.displayName}** - Growing...\n⏳ Time remaining: **${formatTime(cropStatus.timeLeft)}**`;
        }
    }
    
    const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`🌾 ${targetUser.username}'s Farm`)
        .addFields(
            {
                name: '💰 Money',
                value: `**$${userFarm.money.toLocaleString()}**`,
                inline: true
            },
            {
                name: '⭐ Experience',
                value: `**${userFarm.experience}**`,
                inline: true
            },
            {
                name: '🏗️ Land Slots',
                value: `**${userFarm.landSlots}**/100`,
                inline: true
            },
            {
                name: '🌾 Current Crops',
                value: cropDisplay,
                inline: false
            },
            {
                name: '📦 Inventory',
                value: inventoryDisplay,
                inline: false
            }
        )
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

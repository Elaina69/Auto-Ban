import { EmbedBuilder } from 'discord.js';
import { farmManager } from '../../../utils/farmManager.js';

export async function handleFarmLogin(message) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    const { canLogin, nextLogin } = farmManager.canLogin(userId, guildId);
    
    if (!canLogin) {
        const now = new Date();
        const timeLeft = nextLogin.getTime() - now.getTime();
        const hours = Math.floor(timeLeft / (60 * 60 * 1000));
        const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
        
        const embed = new EmbedBuilder()
            .setColor(0xff9900)
            .setTitle('⏰ Already Logged In Today')
            .setDescription(`You\'ve already claimed your daily reward!\n\n⏳ Time until next login: **${hours} hours ${minutes} minutes**`)
            .setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    
    // Process login
    farmManager.processLogin(userId, guildId);
    
    const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎉 Login Successful!')
        .setDescription('You received **$10,000**!')
        .setFooter({ text: 'Come back tomorrow for more rewards' })
        .setTimestamp();
    await message.reply({ embeds: [embed] });
}

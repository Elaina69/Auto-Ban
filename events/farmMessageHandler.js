import { farmManager } from '../utils/farmManager.js';
import { handleFarmHelp } from './commands/farm/help.js';
import { handleFarmLogin } from './commands/farm/login.js';
import { handleFarmStatus } from './commands/farm/status.js';
import { handleFarmGrow } from './commands/farm/grow.js';
import { handleFarmHarvest } from './commands/farm/harvest.js';
import { handleFarmInfo } from './commands/farm/info.js';
import { handleFarmSell } from './commands/farm/sell.js';
import { handleFarmExpand } from './commands/farm/expand.js';
import { handleCropList } from './commands/farm/cropList.js';
import { handleFarmBuy } from './commands/farm/buy.js';
import { handleRoleList, handleRoleBuy } from './commands/farm/roleShop.js';

/**
 * Handle farm prefix commands
 * @param {import('discord.js').Message} message - The message object
 * @returns {Promise<boolean>} - Whether the message was handled
 */
export async function handleFarmMessage(message) {
    // Ignore bots
    if (message.author.bot || !message.guild) return false;
    
    const userId = message.author.id;
    const guildId = message.guild.id;
    
    // Check if farming is enabled
    if (!farmManager.isFarmingEnabled(userId, guildId)) {
        return false;
    }
    
    // Get server farm prefix
    const prefix = farmManager.getServerPrefix(guildId);
    const content = message.content.trim();
    
    // Check if message starts with prefix (case insensitive)
    if (!content.toLowerCase().startsWith(prefix.toLowerCase())) {
        return false;
    }
    
    // Parse command and args
    const args = content.slice(prefix.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();
    
    if (!command) return false;
    
    try {
        switch (command) {
            case 'help':
            case 'h':
                await handleFarmHelp(message);
                return true;
                
            case 'login':
            case 'daily':
                await handleFarmLogin(message);
                return true;
                
            case 'status':
            case 'stats':
            case 'farm':
                await handleFarmStatus(message, args);
                return true;
                
            case 'grow':
            case 'plant':
                await handleFarmGrow(message, args);
                return true;
                
            case 'harvest':
            case 'reap':
                await handleFarmHarvest(message);
                return true;
                
            case 'crop':
                // No args or 'list' -> show crop list
                if (!args.length || args[0]?.toLowerCase() === 'list') {
                    await handleCropList(message, args[0]?.toLowerCase() === 'list' ? args.slice(1) : args);
                } else {
                    // Show specific crop info
                    await handleFarmInfo(message, args);
                }
                return true;
                
            case 'sell':
                await handleFarmSell(message, args);
                return true;
                
            case 'buy':
            case 'purchase':
                await handleFarmBuy(message, args);
                return true;
                
            case 'expand':
                await handleFarmExpand(message);
                return true;
                
            case 'role':
                // Check if args[0] is 'list' or 'buy'
                if (args[0]?.toLowerCase() === 'list') {
                    await handleRoleList(message);
                } else if (args[0]?.toLowerCase() === 'buy') {
                    await handleRoleBuy(message, args.slice(1));
                } else {
                    await handleRoleList(message); // Default to list
                }
                return true;
                
            default:
                return false;
        }
    } catch (err) {
        console.error('Error handling farm command:', err);
        await message.reply('❌ An error occurred while processing your command.').catch(() => {});
        return true;
    }
}

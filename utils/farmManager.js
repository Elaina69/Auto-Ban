import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDailyBuyPrice, getDailySellPrice } from './cropManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const farmDataFile = path.join(__dirname, '../configs/farmData.json');
const serverConfigFile = path.join(__dirname, '../configs/farmServerConfig.json');

class FarmManager {
    /**
     * Load farm data from file
     * @returns {object} - Farm data for all users
     */
    loadFarmData() {
        if (fs.existsSync(farmDataFile)) {
            return JSON.parse(fs.readFileSync(farmDataFile, 'utf8'));
        } else {
            this.saveFarmData({});
            return {};
        }
    }

    /**
     * Save farm data to file
     * @param {object} farmData - Farm data to save
     */
    saveFarmData(farmData) {
        fs.writeFileSync(farmDataFile, JSON.stringify(farmData, null, 4));
    }
    
    /**
     * Load server config (prefix and enabled settings) from file
     * @returns {object} - Server config { guildId: { prefix: string, enabled: { userId: boolean } } }
     */
    loadServerConfig() {
        if (fs.existsSync(serverConfigFile)) {
            return JSON.parse(fs.readFileSync(serverConfigFile, 'utf8'));
        } else {
            this.saveServerConfig({});
            return {};
        }
    }
    
    /**
     * Save server config to file
     * @param {object} config - Server config to save
     */
    saveServerConfig(config) {
        fs.writeFileSync(serverConfigFile, JSON.stringify(config, null, 4));
    }
    
    /**
     * Get farm prefix for a server
     * @param {string} guildId - Discord guild ID
     * @returns {string} - Farm prefix (default: 'h')
     */
    getServerPrefix(guildId) {
        const config = this.loadServerConfig();
        return config[guildId]?.prefix || 'h';
    }
    
    /**
     * Set farm prefix for a server
     * @param {string} guildId - Discord guild ID
     * @param {string} prefix - New prefix
     */
    setServerPrefix(guildId, prefix) {
        const config = this.loadServerConfig();
        if (!config[guildId]) {
            config[guildId] = { prefix: 'h', enabled: {} };
        }
        config[guildId].prefix = prefix;
        this.saveServerConfig(config);
    }

    /**
     * Get user farm data, create if not exists
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID (unused, kept for compatibility)
     * @returns {object} - User farm data
     */
    getUserFarm(userId, guildId) {
        const farmData = this.loadFarmData();
        const key = userId; // Use only userId so data persists across servers
        
        if (!farmData[key]) {
            farmData[key] = {
                money: 5000,
                experience: 0,
                landSlots: 10,
                inventory: {},
                currentCrop: null,
                plantedAt: null,
                lastLogin: null
            };
            this.saveFarmData(farmData);
        }
        
        return farmData[key];
    }

    /**
     * Update user farm data
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID (unused, kept for compatibility)
     * @param {object} updates - Data to update
     */
    updateUserFarm(userId, guildId, updates) {
        const farmData = this.loadFarmData();
        const key = userId; // Use only userId so data persists across servers
        
        if (!farmData[key]) {
            farmData[key] = this.getUserFarm(userId, guildId);
        }
        
        farmData[key] = { ...farmData[key], ...updates };
        this.saveFarmData(farmData);
    }

    /**
     * Check if farming is enabled for user in specific server
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID
     * @returns {boolean} - Whether farming is enabled
     */
    isFarmingEnabled(userId, guildId) {
        const config = this.loadServerConfig();
        if (!config[guildId]) {
            return true; // Default to enabled
        }
        // Default to true if not explicitly set to false
        return config[guildId].enabled?.[userId] !== false;
    }

    /**
     * Enable/disable farming for user in specific server
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID
     * @param {boolean} enabled - Enable or disable
     */
    setFarmingEnabled(userId, guildId, enabled) {
        const config = this.loadServerConfig();
        if (!config[guildId]) {
            config[guildId] = { prefix: 'h', enabled: {} };
        }
        if (!config[guildId].enabled) {
            config[guildId].enabled = {};
        }
        config[guildId].enabled[userId] = enabled;
        this.saveServerConfig(config);
    }

    /**
     * Check if user can login (once per day, UTC+7 timezone)
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID
     * @returns {object} - { canLogin: boolean, nextLogin: Date|null }
     */
    canLogin(userId, guildId) {
        const userFarm = this.getUserFarm(userId, guildId);
        
        if (!userFarm.lastLogin) {
            return { canLogin: true, nextLogin: null };
        }
        
        const lastLogin = new Date(userFarm.lastLogin);
        const now = new Date();
        
        // Convert to UTC+7
        const utc7Offset = 7 * 60 * 60 * 1000;
        const lastLoginUTC7 = new Date(lastLogin.getTime() + utc7Offset);
        const nowUTC7 = new Date(now.getTime() + utc7Offset);
        
        // Get start of day (00:00) in UTC+7
        const lastLoginDay = new Date(lastLoginUTC7.getFullYear(), lastLoginUTC7.getMonth(), lastLoginUTC7.getDate());
        const todayUTC7 = new Date(nowUTC7.getFullYear(), nowUTC7.getMonth(), nowUTC7.getDate());
        
        // Calculate next login time (next day 00:00 UTC+7)
        const nextLogin = new Date(lastLoginDay.getTime() + 24 * 60 * 60 * 1000 - utc7Offset);
        
        if (todayUTC7.getTime() > lastLoginDay.getTime()) {
            return { canLogin: true, nextLogin: null };
        } else {
            return { canLogin: false, nextLogin };
        }
    }

    /**
     * Process login and give reward
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID
     * @returns {boolean} - Whether login was successful
     */
    processLogin(userId, guildId) {
        const { canLogin } = this.canLogin(userId, guildId);
        
        if (!canLogin) {
            return false;
        }
        
        const userFarm = this.getUserFarm(userId, guildId);
        this.updateUserFarm(userId, guildId, {
            money: userFarm.money + 10000,
            lastLogin: new Date().toISOString()
        });
        
        return true;
    }

    /**
     * Calculate yield penalty based on time overdue
     * @param {number} overdueMs - Milliseconds overdue
     * @returns {number} - Multiplier (0.0 to 1.0)
     */
    calculateYieldPenalty(overdueMs) {
        if (overdueMs <= 0) return 1.0;
        
        const hoursOverdue = Math.floor(overdueMs / (60 * 60 * 1000));
        const penalty = hoursOverdue * 0.1; // 10% per hour
        const multiplier = Math.max(0, 1.0 - penalty);
        
        return multiplier;
    }

    /**
     * Check if crops are ready to harvest
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID
     * @returns {object} - { ready: boolean, timeLeft: number, overdue: number }
     */
    getCropStatus(userId, guildId) {
        const userFarm = this.getUserFarm(userId, guildId);
        
        if (!userFarm.currentCrop || !userFarm.plantedAt) {
            return { ready: false, timeLeft: 0, overdue: 0 };
        }
        
        const plantedAt = new Date(userFarm.plantedAt);
        const now = new Date();
        const elapsed = now.getTime() - plantedAt.getTime();
        
        const crop = userFarm.currentCrop;
        const growthTime = crop.growthTime;
        
        if (elapsed >= growthTime) {
            const overdue = elapsed - growthTime;
            return { ready: true, timeLeft: 0, overdue };
        } else {
            const timeLeft = growthTime - elapsed;
            return { ready: false, timeLeft, overdue: 0 };
        }
    }

    /**
     * Plant crops on all land slots
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID
     * @param {object} crop - Crop data
     * @returns {boolean} - Whether planting was successful
     */
    plantCrop(userId, guildId, crop) {
        const userFarm = this.getUserFarm(userId, guildId);
        
        // Check if already growing something
        if (userFarm.currentCrop) {
            return false;
        }
        
        // Check if user has enough money (use buy price)
        const buyPrice = getDailyBuyPrice(crop.name);
        const totalCost = buyPrice * userFarm.landSlots;
        if (userFarm.money < totalCost) {
            return false;
        }
        
        // Deduct money and plant
        this.updateUserFarm(userId, guildId, {
            money: userFarm.money - totalCost,
            currentCrop: crop,
            plantedAt: new Date().toISOString()
        });
        
        return true;
    }

    /**
     * Harvest crops
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID
     * @returns {object|null} - { crop: object, yield: number, experience: number } or null if failed
     */
    harvestCrop(userId, guildId) {
        const userFarm = this.getUserFarm(userId, guildId);
        const cropStatus = this.getCropStatus(userId, guildId);
        
        if (!cropStatus.ready || !userFarm.currentCrop) {
            return null;
        }
        
        const crop = userFarm.currentCrop;
        const penalty = this.calculateYieldPenalty(cropStatus.overdue);
        const baseYield = crop.yield * userFarm.landSlots;
        const actualYield = Math.floor(baseYield * penalty);
        
        // Calculate experience: actualYield / 10 (rounded down)
        const expGained = Math.floor(actualYield / 10);
        
        // Update inventory and experience
        const inventory = { ...userFarm.inventory };
        inventory[crop.name] = (inventory[crop.name] || 0) + actualYield;
        
        this.updateUserFarm(userId, guildId, {
            inventory,
            experience: userFarm.experience + expGained,
            currentCrop: null,
            plantedAt: null
        });
        
        return { crop, yield: actualYield, penalty, experience: expGained };
    }

    /**
     * Sell crops from inventory
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Discord guild ID
     * @param {string} cropName - Name of crop to sell, or 'all'
     * @param {number|string} amount - Amount to sell, or 'all' for all of that crop
     * @returns {object|null} - { amount: number, totalPrice: number, cropName: string } or null if failed
     */
    sellCrop(userId, guildId, cropName, amount = 'all') {
        const userFarm = this.getUserFarm(userId, guildId);
        const inventory = { ...userFarm.inventory };
        
        // Sell all crops in inventory
        if (cropName.toLowerCase() === 'all') {
            let totalPrice = 0;
            let totalAmount = 0;
            
            for (const [name, qty] of Object.entries(inventory)) {
                if (qty > 0) {
                    const dailyPrice = getDailySellPrice(name);
                    totalPrice += qty * dailyPrice;
                    totalAmount += qty;
                }
            }
            
            if (totalAmount === 0) {
                return null;
            }
            
            this.updateUserFarm(userId, guildId, {
                money: userFarm.money + totalPrice,
                inventory: {}
            });
            
            return { amount: totalAmount, totalPrice, cropName: 'all' };
        } 
        // Sell specific crop
        else {
            const availableAmount = inventory[cropName] || 0;
            
            if (availableAmount === 0) {
                return null;
            }
            
            // Determine how much to sell
            let sellAmount;
            if (amount === 'all') {
                sellAmount = availableAmount;
            } else {
                sellAmount = parseInt(amount);
                if (isNaN(sellAmount) || sellAmount <= 0) {
                    return null;
                }
                // Can't sell more than available
                sellAmount = Math.min(sellAmount, availableAmount);
            }
            
            const dailyPrice = getDailySellPrice(cropName);
            const totalPrice = sellAmount * dailyPrice;
            inventory[cropName] = availableAmount - sellAmount;
            
            this.updateUserFarm(userId, guildId, {
                money: userFarm.money + totalPrice,
                inventory
            });
            
            return { amount: sellAmount, totalPrice, cropName };
        }
    }
}

export const farmManager = new FarmManager();

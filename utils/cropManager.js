import { crops } from '../configs/crops.js';

/**
 * Get crop info by name (case-insensitive)
 * @param {string} name - Crop name
 * @returns {object|null} - Crop data or null if not found
 */
export function getCrop(name) {
    const normalizedName = name.toLowerCase().trim();
    return crops[normalizedName] || null;
}

/**
 * Get all crop names
 * @returns {string[]} - Array of crop names
 */
export function getAllCropNames() {
    return Object.keys(crops);
}

/**
 * Calculate land slot price based on number of slots already owned
 * Formula: 20000 + (currentSlots * 5000)
 * @param {number} currentSlots - Number of slots currently owned
 * @returns {number} - Price for next slot
 */
export function calculateSlotPrice(currentSlots) {
    return 20000 + (currentSlots * 5000);
}

/**
 * Format time remaining
 * @param {number} ms - Milliseconds
 * @returns {string} - Formatted time string
 */
export function formatTime(ms) {
    if (ms <= 0) return '0 Hour 0 Minute';
    
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    
    return `${hours} Hour ${minutes} Minute`;
}

/**
 * Get daily sell price for a crop
 * Price fluctuates between $1 to $10 based on 6-hour periods
 * Uses a seeded random based on crop name and time period to ensure consistency within 6 hours
 * @param {string} cropName - Name of the crop
 * @param {Date} [date=new Date()] - Date to calculate price for (defaults to now)
 * @returns {number} - Sell price ($1 to $10)
 */
export function getDailySellPrice(cropName, date = new Date()) {
    // Get UTC+7 time
    const utc7Date = new Date(date.getTime() + (7 * 60 * 60 * 1000));
    const dateString = utc7Date.toISOString().split('T')[0]; // YYYY-MM-DD
    const hours = utc7Date.getUTCHours();
    
    // Calculate 6-hour period (0-3)
    // Period 0: 00:00-06:00, Period 1: 06:00-12:00, Period 2: 12:00-18:00, Period 3: 18:00-00:00
    const period = Math.floor(hours / 6);
    const periodString = `${dateString}-${period}`;
    
    // Simple seeded random using crop name + date + period + 'sell' to differentiate from buy price
    const seed = hashString(cropName.toLowerCase() + periodString + 'sell');
    const random = seededRandom(seed);
    
    // Map random [0,1) to [1, 10]
    const price = 1 + (random * 9);
    
    return Math.round(price * 100) / 100; // Round to 2 decimal places
}

/**
 * Get daily buy price for a crop (seeds and fruits)
 * Buy price is always $1-$3 higher than sell price
 * Uses a seeded random based on crop name and time period to ensure consistency within 6 hours
 * @param {string} cropName - Name of the crop
 * @param {Date} [date=new Date()] - Date to calculate price for (defaults to now)
 * @returns {number} - Buy price (sell price + $1 to $3)
 */
export function getDailyBuyPrice(cropName, date = new Date()) {
    // Get sell price first
    const sellPrice = getDailySellPrice(cropName, date);
    
    // Get UTC+7 time
    const utc7Date = new Date(date.getTime() + (7 * 60 * 60 * 1000));
    const dateString = utc7Date.toISOString().split('T')[0]; // YYYY-MM-DD
    const hours = utc7Date.getUTCHours();
    
    // Calculate 6-hour period (0-3)
    const period = Math.floor(hours / 6);
    const periodString = `${dateString}-${period}`;
    
    // Simple seeded random using crop name + date + period + 'buy' to differentiate from sell price
    const seed = hashString(cropName.toLowerCase() + periodString + 'buy');
    const random = seededRandom(seed);
    
    // Buy price is sell price + $1 to $3
    const markup = 1 + (random * 2);
    const price = sellPrice + markup;
    
    return Math.round(price * 100) / 100; // Round to 2 decimal places
}

/**
 * Simple string hash function
 * @param {string} str - String to hash
 * @returns {number} - Hash value
 */
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

/**
 * Seeded random number generator
 * @param {number} seed - Seed value
 * @returns {number} - Random number between 0 and 1
 */
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

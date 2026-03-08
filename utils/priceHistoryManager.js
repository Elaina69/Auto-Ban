import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDailyBuyPrice, getDailySellPrice, getAllCropNames } from './cropManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const priceHistoryFile = path.join(__dirname, '../configs/priceHistory.json');

class PriceHistoryManager {
    /**
     * Load price history from file
     * @returns {object} - Price history data
     */
    loadPriceHistory() {
        if (!fs.existsSync(priceHistoryFile)) {
            return {};
        }
        const data = fs.readFileSync(priceHistoryFile, 'utf8');
        return JSON.parse(data);
    }

    /**
     * Save price history to file
     * @param {object} data - Price history data
     */
    savePriceHistory(data) {
        fs.writeFileSync(priceHistoryFile, JSON.stringify(data, null, 4));
    }

    /**
     * Get current timestamp for 6-hour period
     * @returns {string} - Timestamp string (YYYY-MM-DD-HH)
     */
    getCurrentPeriodKey() {
        const now = new Date();
        const utc7Date = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        const dateString = utc7Date.toISOString().split('T')[0];
        const hours = utc7Date.getUTCHours();
        const period = Math.floor(hours / 6) * 6; // 0, 6, 12, 18
        return `${dateString}-${String(period).padStart(2, '0')}`;
    }

    /**
     * Update price history for all crops
     * Keeps only last 5 days (20 periods of 6 hours)
     */
    updatePriceHistory() {
        const history = this.loadPriceHistory();
        const periodKey = this.getCurrentPeriodKey();
        const allCrops = getAllCropNames();

        // Check if this period already exists
        const needsUpdate = !history.lastUpdate || history.lastUpdate !== periodKey;
        
        if (!needsUpdate) {
            return; // Already updated for this period
        }

        // Initialize history structure if needed
        if (!history.data) {
            history.data = {};
        }

        // Update prices for all crops
        for (const cropName of allCrops) {
            if (!history.data[cropName]) {
                history.data[cropName] = [];
            }

            const buyPrice = getDailyBuyPrice(cropName);
            const sellPrice = getDailySellPrice(cropName);

            // Add new price point
            history.data[cropName].push({
                timestamp: periodKey,
                buy: buyPrice,
                sell: sellPrice
            });

            // Keep only last 20 periods (5 days * 4 periods per day)
            if (history.data[cropName].length > 20) {
                history.data[cropName] = history.data[cropName].slice(-20);
            }
        }

        history.lastUpdate = periodKey;
        this.savePriceHistory(history);
    }

    /**
     * Get price history for a specific crop
     * @param {string} cropName - Name of the crop
     * @returns {Array} - Array of price points
     */
    getCropPriceHistory(cropName) {
        this.updatePriceHistory(); // Ensure we have latest data
        const history = this.loadPriceHistory();
        return history.data?.[cropName] || [];
    }

    /**
     * Generate QuickChart URL for price history
     * @param {string} cropName - Name of the crop
     * @param {string} displayName - Display name of the crop
     * @returns {string} - QuickChart URL
     */
    generatePriceChart(cropName, displayName) {
        const priceHistory = this.getCropPriceHistory(cropName);
        
        if (priceHistory.length === 0) {
            return null;
        }

        // Prepare data for chart
        const labels = priceHistory.map(p => {
            const parts = p.timestamp.split('-'); // ['2025', '12', '28', '00']
            const month = parts[1]; // '12'
            const day = parts[2]; // '28'
            const hour = parts[3]; // '00'
            return `${month}/${day} ${hour}h`;
        });

        const buyPrices = priceHistory.map(p => p.buy);
        const sellPrices = priceHistory.map(p => p.sell);

        // Create simplified Chart.js configuration
        const chartConfig = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Buy',
                        data: buyPrices,
                        borderColor: 'rgb(255,99,132)',
                        borderWidth: 2,
                        pointRadius: 3,
                        fill: false
                    },
                    {
                        label: 'Sell',
                        data: sellPrices,
                        borderColor: 'rgb(54,162,235)',
                        borderWidth: 2,
                        pointRadius: 3,
                        fill: false
                    }
                ]
            },
            options: {
                title: {
                    display: true,
                    text: `${displayName} - 5 Days`,
                    fontColor: '#fff'
                },
                legend: {
                    display: true,
                    labels: { fontColor: '#fff' }
                },
                scales: {
                    yAxes: [{
                        ticks: {
                            fontColor: '#fff',
                            callback: function(value) {
                                return '$' + value;
                            }
                        }
                    }],
                    xAxes: [{
                        ticks: {
                            fontColor: '#fff',
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }]
                }
            }
        };

        // Encode chart config for QuickChart API
        const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
        return `https://quickchart.io/chart?bkg=rgb(40,40,40)&c=${encodedConfig}&width=800&height=400`;
    }
}

export const priceHistoryManager = new PriceHistoryManager();

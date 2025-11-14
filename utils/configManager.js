import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import lang from '../configs/lang.js';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const botConfigFile = path.join(__dirname, '../configs/botConfig.json');
const serverConfigFile = path.join(__dirname, '../configs/serverConfig.json');
const bannedAccountsFile = path.join(__dirname, '../configs/bannedAccountsServers.json');

/**
 * Asks a question in the console and returns the answer.
 * @param {string} query - The question to ask.
 * @returns {Promise<string>} - The answer provided by the user.
 */
async function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

// Load bot configuration from file
async function loadBotConfig() {
    if (fs.existsSync(botConfigFile)) {
        return JSON.parse(fs.readFileSync(botConfigFile, 'utf8'));
    } 
    else {
        console.log(lang.noBotConfigFile);

        // Create new bot configuration
        const token = await askQuestion(lang.askToken);
        const botId = await askQuestion(lang.askBotId);
        const deleteMessage = await askQuestion(lang.askDeleteMessage);
        const timeDeleteMessage = await askQuestion(lang.askTimeDeleteMessage);
        const channelSpamThreshold = await askQuestion(lang.askChannelSpamThreshold);
        const spamWindowMs = await askQuestion(lang.askSpamWindowMs);

        const botConfig = {
            token: token.trim(),
            botId: botId.trim(),
            deleteMessage: /^y(es)?$/i.test(deleteMessage.trim()),
            timeDeleteMessage: parseInt(timeDeleteMessage.trim()) || 86400000,
            channelSpamThreshold: parseInt(channelSpamThreshold.trim()) || 3,
            spamWindowMs: parseInt(spamWindowMs.trim()) || 6000
        };

        fs.writeFileSync(botConfigFile, JSON.stringify(botConfig, null, 4));
        console.log(lang.savedBotConfig);

        return botConfig;
    }
}

// Load server configuration from file
function loadServerConfig() {
    if (fs.existsSync(serverConfigFile)) {
        return JSON.parse(fs.readFileSync(serverConfigFile, 'utf8'));
    } 
    else {
        saveServerConfig({});
        return {};
    }
}

/**
 * Saves the server configuration to a file.
 * @param {object} serverConfig - The server configuration to save.
 */
function saveServerConfig(serverConfig) {
    fs.writeFileSync(serverConfigFile, JSON.stringify(serverConfig, null, 4));
}

// Load banned accounts from file
function loadBannedAccounts() {
    if (fs.existsSync(bannedAccountsFile)) {
        return JSON.parse(fs.readFileSync(bannedAccountsFile, 'utf8'));
    } 
    else {
        saveBannedAccounts({});
        return {};
    }
}

/**
 * Saves the banned accounts to a file.
 * @param {object} bannedAccounts - The banned accounts to save.
 */
function saveBannedAccounts(bannedAccounts) {
    fs.writeFileSync(bannedAccountsFile, JSON.stringify(bannedAccounts, null, 4));
}

export {
    loadBotConfig,
    loadServerConfig,
    saveServerConfig,
    loadBannedAccounts,
    saveBannedAccounts
}
import path from 'path';
import { fileURLToPath } from 'url';
import lang from '../configs/lang.js';
import readline from 'readline';
import { readJsonFile, updateJsonFile, writeJsonFile } from './safeJsonStore.js';
import { getBotConfigFileName, resolveBotInstance } from './runtimeInstance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// botConfig is per-instance, serverConfig and bannedAccounts are shared
const botInstance = resolveBotInstance();
const botConfigFile = path.join(__dirname, '../configs', getBotConfigFileName(botInstance));
const serverConfigFile = path.join(__dirname, '../configs/serverConfig.json');
const bannedAccountsFile = path.join(__dirname, '../configs/bannedAccountsServers.json');
const raidIncidentsFile = path.join(__dirname, '../configs/raidIncidents.json');

class ConfigManager {
    getBotInstance() {
        return botInstance;
    }

    getBotConfigFile() {
        return botConfigFile;
    }

    /**
    * Asks a question in the console and returns the answer.
    * @param {string} query - The question to ask.
    * @returns {Promise<string>} - The answer provided by the user.
    */
    async askQuestion(query) {
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
    async loadBotConfig() {
        try {
            return readJsonFile(botConfigFile, { allowDefault: false });
        } catch (err) {
            console.warn(`[CONFIG] Could not load ${path.basename(botConfigFile)}: ${err.message}`);
        }

        console.log(lang.noBotConfigFile);

        // Create new bot configuration
        const token = await this.askQuestion(lang.askToken);
        const botId = await this.askQuestion(lang.askBotId);
        const deleteMessage = await this.askQuestion(lang.askDeleteMessage);
        const timeDeleteMessage = await this.askQuestion(lang.askTimeDeleteMessage);
        const channelSpamThreshold = await this.askQuestion(lang.askChannelSpamThreshold);
        const spamWindowMs = await this.askQuestion(lang.askSpamWindowMs);

        const botConfig = {
            token: token.trim(),
            botId: botId.trim(),
            deleteMessage: /^y(es)?$/i.test(deleteMessage.trim()),
            timeDeleteMessage: parseInt(timeDeleteMessage.trim()) || 86400000,
            channelSpamThreshold: parseInt(channelSpamThreshold.trim()) || 3,
            spamWindowMs: parseInt(spamWindowMs.trim()) || 6000,
            banMessageContentPolicy: 'snippet',
            banMessageContentMaxLength: 512,
            banEvidenceRetentionDays: 90,
            reuploadModerationAttachments: false
        };

        writeJsonFile(botConfigFile, botConfig);
        console.log(lang.savedBotConfig);

        return botConfig;
    }

    // Load server configuration from file
    loadServerConfig() {
        return readJsonFile(serverConfigFile, { defaultValue: {} });
    }

    /**
     * Saves the server configuration to a file.
     * @param {object} serverConfig - The server configuration to save.
     */
    saveServerConfig(serverConfig) {
        writeJsonFile(serverConfigFile, serverConfig);
    }

    /**
     * Updates server configuration while holding the config lock.
     * @param {(serverConfig: object) => any} updater - Mutates and/or reads the config.
     * @returns {any}
     */
    updateServerConfig(updater) {
        return updateJsonFile(serverConfigFile, {}, updater);
    }

    // Load banned accounts from file
    loadBannedAccounts() {
        return readJsonFile(bannedAccountsFile, { defaultValue: {} });
    }

    /**
     * Saves the banned accounts to a file.
     * @param {object} bannedAccounts - The banned accounts to save.
     */
    saveBannedAccounts(bannedAccounts) {
        writeJsonFile(bannedAccountsFile, bannedAccounts);
    }

    /**
     * Updates banned accounts while holding the config lock.
     * @param {(bannedAccounts: object) => any} updater - Mutates and/or reads the config.
     * @returns {any}
     */
    updateBannedAccounts(updater) {
        return updateJsonFile(bannedAccountsFile, {}, updater);
    }

    loadRaidIncidents() {
        return readJsonFile(raidIncidentsFile, { defaultValue: {} });
    }

    updateRaidIncidents(updater) {
        return updateJsonFile(raidIncidentsFile, {}, updater);
    }

    pruneExpiredModerationData(now = Date.now()) {
        this.updateBannedAccounts(accounts => {
            for (const guildBans of Object.values(accounts)) {
                if (!guildBans || typeof guildBans !== 'object') continue;

                for (const record of Object.values(guildBans)) {
                    if (!record?.evidenceExpiresAt) continue;
                    if (Date.parse(record.evidenceExpiresAt) > now) continue;

                    record.lastBannedMessage = lang.noMessageContent;
                    delete record.contentFingerprint;
                    delete record.messageIds;
                    delete record.channelIds;
                    delete record.evidenceExpiresAt;
                }
            }
        });

        this.updateRaidIncidents(incidents => {
            for (const [guildId, guildIncidents] of Object.entries(incidents)) {
                if (!Array.isArray(guildIncidents)) {
                    delete incidents[guildId];
                    continue;
                }

                incidents[guildId] = guildIncidents.filter(incident =>
                    !incident?.expiresAt || Date.parse(incident.expiresAt) > now
                );

                if (incidents[guildId].length === 0) delete incidents[guildId];
            }
        });
    }

    countingUsedServers() {
        const serverConfig = this.loadServerConfig();
        return Object.keys(serverConfig).length;
    }
}

export const configManager = new ConfigManager();

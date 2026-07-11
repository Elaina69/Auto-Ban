// Import Discord Lib
import { Client, GatewayIntentBits, Events } from 'discord.js';
// Import Utils
import { configManager } from './utils/configManager.js';
import { setupLockfile } from './utils/lockfile.js';
import { format } from './utils/formatLang.js';
import path from 'path';
import { fileURLToPath } from 'url';
// Import bot's events
import { HandleInteractionCreate } from './events/interactionCreate.js';
import handleMessageCreate from './events/messageCreate.js';
import {
    handleGuildMemberAdd,
    handleGuildMemberRemove,
    handleGuildMemberUpdate
} from './events/guildMemberEvents.js';
// Import bot's commands
import { registerCommands } from './events/commands.js';
// Import language file
import lang from './configs/lang.js';
// Import logger
import { Logger } from './utils/logger.js';
// Import price history manager
import { priceHistoryManager } from './utils/priceHistoryManager.js';
// Import backup manager
import { backupManager } from './utils/backupManager.js';
// Import runtime instance helpers
import { getBackupOwner, resolveBotInstance, shouldRunBackupsForInstance } from './utils/runtimeInstance.js';


// Initialize logger
const botInstance = resolveBotInstance();
const logger = new Logger();
console.log(`[STARTUP] Auto-Ban instance ${botInstance} is starting.`);

// Setup file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Recover configs before loading runtime state
backupManager.recoverConfigs();

// Load bot's config
const botConfig = await configManager.loadBotConfig();
configManager.pruneExpiredModerationData();

// Backup configs from one owner process when multiple instances are launched together.
const shouldRunBackups = shouldRunBackupsForInstance();
const backupOwner = getBackupOwner();

if (shouldRunBackups) {
    try {
        backupManager.createBackup('startup');
    } catch (err) {
        console.error('[BACKUP] Startup backup failed:', err);
    }

    backupManager.scheduleWeeklyBackups();
} else {
    console.log(`[BACKUP] Skipping backups for instance ${botInstance}; owner is instance ${backupOwner}.`);
}

// Setup lockfile
setupLockfile(botConfig.botId, __dirname, lang);

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

// Register bot commands
await registerCommands(botConfig.token, botConfig.botId);

// Log bot online
client.once(Events.ClientReady, () => {
    console.log(format(lang.botOnline, { tag: client.user.tag }));
    
    // Initialize price history on startup
    priceHistoryManager.updatePriceHistory();
});

// Handle interactions
client.on(Events.InteractionCreate, interaction => {
    const handleInteractionCreate = new HandleInteractionCreate();
    handleInteractionCreate.createCommandsInteraction(interaction);
});

// Handle messages
client.on(Events.MessageCreate, message =>
    handleMessageCreate(message, client)
);

client.on(Events.GuildMemberAdd, handleGuildMemberAdd);
client.on(Events.GuildMemberUpdate, handleGuildMemberUpdate);
client.on(Events.GuildMemberRemove, handleGuildMemberRemove);

// Login bot to Discord
client.login(botConfig.token);

// Print number of serve

// Update price history every 6 hours
setInterval(() => {
    priceHistoryManager.updatePriceHistory();
    console.log('📊 Price history updated');
}, 6 * 60 * 60 * 1000); // Every 6 hoursr using this bot
setInterval(() => {
    const usedServers = configManager.countingUsedServers();
    console.log(format(lang.currentUsedServers, { count: usedServers }));
}, 12 * 60 * 60 * 1000);

setInterval(() => {
    configManager.pruneExpiredModerationData();
}, 12 * 60 * 60 * 1000);


// Handle process errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [UnhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
    console.error('❌ [UncaughtException]', err);
});

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
// Import bot's commands
import { registerCommands } from './events/commands.js';
// Import language file
import lang from './configs/lang.js';
// Import logger
import { Logger } from './utils/logger.js';


// Initialize logger
const logger = new Logger();
logger.hookConsole();

// Setup file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load bot's config
const botConfig = await configManager.loadBotConfig();

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

// Login bot to Discord
client.login(botConfig.token);

// Print number of server using this bot
setInterval(() => {
    const usedServers = configManager.countingUsedServers();
    console.log(format(lang.currentUsedServers, { count: usedServers }));
}, 12 * 60 * 60 * 1000);


// Handle process errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [UnhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
    console.error('❌ [UncaughtException]', err);
});
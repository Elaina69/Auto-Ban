// Import Discord Lib
import { Client, GatewayIntentBits, Events } from 'discord.js';

// Import Utils
import { loadBotConfig, loadServerConfig, loadBannedAccounts } from './utils/config.js';
import { setupLockfile } from './utils/lockfile.js';
import { format } from './utils/formatLang.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Import bot's events
import handleInteractionCreate from './events/interactionCreate.js';
import handleMessageCreate from './events/messageCreate.js';

// Import bot's commands
import { registerCommands } from './bot.js';

// Import language file
import lang from './configs/lang.js';

// Setup file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load bot's config
const botConfig = await loadBotConfig();
const serverConfig = loadServerConfig();
const bannedAccounts = loadBannedAccounts();

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
client.on(Events.InteractionCreate, interaction =>
    handleInteractionCreate(interaction, serverConfig, bannedAccounts)
);

// Handle messages
client.on(Events.MessageCreate, message =>
    handleMessageCreate(message, serverConfig, bannedAccounts, botConfig, client)
);

// Login bot to Discord
client.login(botConfig.token);


// Handle process errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [UnhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
    console.error('❌ [UncaughtException]', err);
});
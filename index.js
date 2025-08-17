import { 
    Client, GatewayIntentBits, Events, 
    REST, Routes, SlashCommandBuilder, 
    ChannelType, PermissionFlagsBits, MessageFlags 
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import botConfig from './configs/botConfig.js'
import lang from './configs/lang.js';

const token = botConfig.token;
const botId = botConfig.botId;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverConfigFile = path.join(__dirname, 'configs/serverConfig.json');
const bannedAccountsFile = path.join(__dirname, 'configs/bannedAccountsServers.json');
const lockFilePath = path.join(__dirname, `${botConfig.botId}.lock`);

// Check if a process is running
function isProcessRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return false;
    }
}

// Check lockfile
if (fs.existsSync(lockFilePath)) {
    const oldPid = parseInt(fs.readFileSync(lockFilePath, "utf-8"), 10);

    if (isNaN(oldPid) || !isProcessRunning(oldPid)) {
        console.warn(format(lang.duplicatedLockFile, { oldPid }));
        fs.unlinkSync(lockFilePath);
    } else {
        console.error(format(lang.lockFileInUse, { botId, oldPid }));
        process.exit(1);
    }
}

// Create lockfile for bot
fs.writeFileSync(lockFilePath, String(process.pid));

// Remove lockfile on exit
process.on("exit", () => {
    if (fs.existsSync(lockFilePath)) {
        fs.unlinkSync(lockFilePath);
    }
});
process.on("SIGINT", () => process.exit());
process.on("SIGTERM", () => process.exit());

// Load config
let serverConfig = {};
if (fs.existsSync(serverConfigFile)) {
    serverConfig = JSON.parse(fs.readFileSync(serverConfigFile, 'utf8'));
}

// Load banned accounts
let bannedAccounts = {};
if (fs.existsSync(bannedAccountsFile)) {
    bannedAccounts = JSON.parse(fs.readFileSync(bannedAccountsFile, 'utf8'));
}

function format(template, data = {}) {
    return template.replace(/{(\w+)}/g, (_, key) => data[key] ?? `{${key}}`);
}

// Save config
function saveConfig() {
    fs.writeFileSync(serverConfigFile, JSON.stringify(serverConfig, null, 4));
}

// Save banned accounts
function saveBannedAccounts() {
    fs.writeFileSync(bannedAccountsFile, JSON.stringify(bannedAccounts, null, 4));
}

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

// Slash command setup
const commands = [
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription(lang.setupDescription)
        .addChannelOption(option =>
            option.setName('channeltoban')
                .setDescription(lang.setupChannelToBanDescription)
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption(option =>
            option.setName('notifychannel')
                .setDescription(lang.setupNotifyChannelDescription)
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('banlist')
        .setDescription(lang.bannedListDescription)
].map(cmd => cmd.toJSON());

// Register slash commands globally
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(lang.registeringCommands);
        await rest.put(Routes.applicationCommands(botId), { body: commands });
        console.log(lang.commandRegistered);
    } catch (err) {
        console.error(lang.commandRegisterError, err);
    }
})();

// Bot online
client.once(Events.ClientReady, () => {
    console.log(format(lang.botOnline, { tag: client.user.tag }));
});

// Handle interaction commands
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'setup') {
        const guildId = interaction.guildId;
        const channelToBan = interaction.options.getChannel('channeltoban');
        const notifyChannel = interaction.options.getChannel('notifychannel');

        serverConfig[guildId] = {
            bannedChannelId: channelToBan.id,
            notifyChannelId: notifyChannel?.id ?? null
        };
        saveConfig();

        await interaction.reply({
            content: `${lang.setupCompleted}\n- ${format(lang.bannedChannel, { channelToBan: channelToBan })}` +
                (notifyChannel ? `\n- ${format(lang.notifyChannel, { notifyChannel: notifyChannel })}` : ''),
            flags: MessageFlags.Ephemeral
        });
    }

    if (interaction.commandName === 'banlist') {
        const guildId = interaction.guildId;
        const list = bannedAccounts[guildId] || [];

        if (list.length === 0) {
            await interaction.reply({
                content: lang.noBannedAccounts,
                flags: MessageFlags.Ephemeral
            });
        } else {
            const names = list.map(acc => `- ${acc}`).join("\n");
            await interaction.reply({
                content: format(lang.bannedAccountsList, { list: names }),
                flags: MessageFlags.Ephemeral
            });
        }
    }
});

// Events when someone sends a message in the banned channel
client.on(Events.MessageCreate, async message => {
    try {
        if (message.author.bot || !message.guild) return;

        const guildId = message.guild.id;
        const settings = serverConfig[guildId];
        if (!settings) return;

        if (message.channel.id === settings.bannedChannelId) {
            try {
                await message.guild.members.ban(message.author.id, {
                    reason: `${lang.banReason}.`
                });
                console.log(format(lang.banSuccessLog, { username: message.author.tag, guildId }));

                // Save into bannedAccounts
                if (!bannedAccounts[guildId]) {
                    bannedAccounts[guildId] = [];
                }
                if (!bannedAccounts[guildId].includes(message.author.tag)) {
                    bannedAccounts[guildId].push(message.author.tag);
                    saveBannedAccounts();
                }

                // Send notification if notify channel is set
                if (settings.notifyChannelId) {
                    try {
                        const notifyChannel = await message.guild.channels.fetch(settings.notifyChannelId);

                        if (
                            notifyChannel &&
                            notifyChannel.isTextBased?.() &&
                            notifyChannel.viewable &&
                            notifyChannel.permissionsFor(client.user)?.has('SendMessages')
                        ) {
                            // Get message content
                            let content = message.content || lang.noMessageContent;

                            // Send notification embed
                            await notifyChannel.send({
                                embeds: [
                                    {
                                        color: 0xff0000,
                                        title: "🚫 User Banned",
                                        fields: [
                                            { name: "User", value: `${message.author.tag} (<@${message.author.id}>)`, inline: false },
                                            { name: "Reason", value: lang.banReason, inline: false },
                                            { name: "Message Content", value: content.substring(0, 1024) || lang.noMessageContent, inline: false },
                                            { name: "Channel", value: `<#${message.channel.id}>`, inline: true }
                                        ],
                                        timestamp: new Date().toISOString(),
                                    }
                                ]
                            });

                            // Reupload attachments if any
                            if (message.attachments.size > 0) {
                                for (const [_, att] of message.attachments) {
                                    try {
                                        // Download file from original link
                                        const response = await fetch(att.url);
                                        const buffer = Buffer.from(await response.arrayBuffer());

                                        // Reupload to notify channel
                                        await notifyChannel.send({
                                            content: format(lang.deletedFiles, { tag: message.author.tag, id: att.id }),
                                            files: [{ attachment: buffer, name: att.name }]
                                        });
                                    } catch (err) {
                                        console.error(format(lang.downloadFilesErrorLog, { url: att.url }), err.message);
                                        await notifyChannel.send(format(lang.downloadFilesError, { tag: message.author.tag }) + att.url);
                                    }
                                }
                            }
                        } else {
                            console.warn(format(lang.noPermissionToNotify, { channelName: notifyChannel?.name || 'unknown' }));
                        }

                    } catch (err) {
                        console.warn(lang.notifyError, err.message);
                    }
                }

                // Delete messages from the user in all text channels
                if (botConfig.deleteMessage) {
                    const now = Date.now();
                    const timeDeleteMessages = now - botConfig.timeDeleteMessage;

                    for (const [channelId, channel] of message.guild.channels.cache) {
                        if (channel.type !== ChannelType.GuildText || !channel.viewable || !channel.permissionsFor(client.user)?.has('ManageMessages')) {
                            continue;
                        }

                        try {
                            const messages = await channel.messages.fetch({ limit: 100 });
                            const userMessages = messages.filter(msg =>
                                msg.author.id === message.author.id &&
                                msg.createdTimestamp >= timeDeleteMessages
                            );

                            for (const [_, msg] of userMessages) {
                                await msg.delete().catch(() => {});
                            }

                            if (userMessages.size > 0) {
                                console.log(format(lang.deletedMessagesLog, { count: userMessages.size, username: message.author.tag, channelName: channel.name }));
                            }

                        } catch (err) {
                            console.warn(format(lang.deleteError, { channelName: channel.name }), err.message);
                        }
                    }
                }
            } catch (err) {
                console.error(format(lang.cannotBanUser, { username: message.author.tag }), err);
            }
        }
    } catch (err) {
        console.error(format(lang.messageCreateError), err);
    }
});

client.login(token);

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [UnhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
    console.error('❌ [UncaughtException]', err);
});
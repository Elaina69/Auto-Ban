export default {
    // Load or create new bot config
    noBotConfigFile                 : "⚙️ Bot config does not exist, please provide the following information:",
    askToken                        : "👉 Enter bot token (String): ",
    askBotId                        : "👉 Enter bot ID (String): ",
    askDeleteMessage                : "👉 Delete message after ban? (yes/no): ",
    askTimeDeleteMessage            : "👉 Time to delete message (ms, e.g. 86400000 = 1 day): ",
    savedBotConfig                  : "✅ Bot config saved to configs/botConfig.json",

    // Check lockfile
    duplicatedLockFile              : "[WARN] Found old lock file (pid=${oldPid}), process no longer exists. Deleting lock file and restarting.",
    lockFileInUse                   : "[ERROR] Bot with botId ${botId} is already running (pid=${oldPid}).",

    // Slash command setup
    setupDescription                : "Setup auto-ban bot.",
    setupChannelToBanDescription    : "Channel to ban users who send messages here.",
    setupNotifyChannelDescription   : "Channel to notify when a user is banned.",
    bannedListDescription           : "List of banned users in this server.",

    // Register slash commands globally
    registeringCommands             : "Registering GLOBAL slash commands...",
    commandRegistered               : "✅ Slash commands registered globally.",
    commandRegisterError            : "Failed to register slash commands: ",

    // Bot online
    botOnline                       : "🤖 Bot online as: {tag}",

    // Handle interaction commands
    setupCompleted                  : "✅ Setup completed",
    bannedChannel                   : "Banned channel: <#{channelToBan}>",
    notifyChannel                   : "Notification channel: <#{notifyChannel}>",
    noBannedAccounts                : "✅ Currently, there are no banned accounts in this server.",
    bannedAccountsList              : "📜 **List of banned accounts by bot in the server:**\n{list}",

    // Events when someone sends a message in the banned channel
    banReason                       : "Bot spam",
    banSuccessLog                   : "🚫 Banned {username} in server {guildId}.",

    noMessageContent                : "No message content.",
    deletedFiles                    : "📎 File from {tag} ({id})",
    downloadFilesErrorLog           : "Cannot download file {att.url}:",
    downloadFilesError              : "⚠️ Cannot download file from {message.author.tag}: ",

    noPermissionToNotify            : "⚠️ Bot lacks permission to send messages in channel #{channelName}.",
    notifyError                     : "❌ Failed to send notification: ",

    deletedMessagesLog              : "🧹 Deleted {count} messages from {username} in channel #{channelName}.",
    deleteError                     : "⚠️ Failed to delete messages in #{channelName}: ",

    cannotBanUserLog                : "❌ Unable to ban {username}: ",
    cannotBanUser                   : "❌ Unable to ban user",
    cannotBanUserNotify             : "❌ Unable to ban user {username} in channel #{channelName}. Please check the bot's permissions.",
    cannotBanUserNotifyError        : "❌ Unable to send ban message:",

    messageCreateError              : "❌ Error in MessageCreate: ",
}
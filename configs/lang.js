export default {
    setupDescription                : "Setup auto-ban bot.",
    setupChannelToBanDescription    : "Channel to ban users who send messages here.",
    setupNotifyChannelDescription   : "Channel to notify when a user is banned.",

    registeringCommands             : "Registering GLOBAL slash commands...",
    commandRegistered               : "✅ Slash commands registered globally.",
    commandRegisterError            : "Failed to register slash commands: ",

    botOnline                       : "🤖 Bot online as: {tag}",
    setupCompleted                  : "✅ Setup completed",
    bannedChannel                   : "Banned channel: <#{channelToBan}>",
    notifyChannel                   : "Notification channel: <#{notifyChannel}>",

    banReason                       : "Bot spam",

    banSuccessLog                   : "🚫 Banned {username} in server {guildId}",
    userBanned                      : "🚫 **{username}** has been banned ({banReason}).",
    noPermissionToNotify            : "⚠️ Bot lacks permission to send messages in channel #{channelName}",
    notifyError                     : "❌ Failed to send notification: ",

    deletedMessagesLo               : "🧹 Deleted {count} messages from {username} in channel #{channelName}",
    deleteError                     : "⚠️ Failed to delete messages in #{channelName}: ",
    cannotBanUser                   : "❌ Unable to ban {username}: ",
    messageCreateError              : "❌ Error in MessageCreate: ",
}
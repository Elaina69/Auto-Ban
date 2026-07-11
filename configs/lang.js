export default {
    // index.js
    botOnline                       : "Bot online as: {tag}",
    currentUsedServers              : "Current number of servers using this bot: {count}",

    // utils/configManager.js
    noBotConfigFile                 : "⚙️ Bot config does not exist, please provide the following information:",
    askToken                        : "👉 Enter bot token (String): ",
    askBotId                        : "👉 Enter bot ID (String): ",
    askDeleteMessage                : "👉 Delete message after ban? (yes/no): ",
    askTimeDeleteMessage            : "👉 Time to delete message (ms, e.g. 86400000 = 1 day): ",
    askChannelSpamThreshold         : "👉 Number of channels to consider spam in the time window: ",
    askSpamWindowMs                 : "👉 Time window to track spam (ms, e.g. 6000 = 6 seconds): ",
    savedBotConfig                  : "✅ Bot config saved to configs/botConfig.json",

    // utils/lockfile.js
    duplicatedLockFile              : "[WARN] Found old lock file (pid=${oldPid}), process no longer exists. Deleting lock file and restarting.",
    lockFileInUse                   : "[ERROR] Bot with botId ${botId} is already running (pid=${oldPid}).",

    // events/commands.js
    helpCommandDescription          : "Show all available commands and their usage.",
    setupDescription                : "Setup auto-ban bot.",
    setupChannelToBanDescription    : "Channel to ban users who send messages here.",
    setupNotifyChannelDescription   : "Channel to notify when a user is banned.",
    bannedListDescription           : "List of banned users in this server.",
    checkBotPermissionDescription   : "Check the bot's permissions in a channel",
    checkBotPermissionChannelDesc   : "Channel to check (defaults to current channel if not provided)",
    registeringCommands             : "Registering GLOBAL slash commands...",
    commandRegistered               : "✅ Slash commands registered globally.",
    commandRegisterError            : "Failed to register slash commands: ",

    // events/commands/setup.js
    setupCompleted                  : "✅ Setup completed",
    bannedChannel                   : "Banned channel: <#{channelToBan}>",
    notifyChannel                   : "Notification channel: <#{notifyChannel}>",
    
    // events/commands/banList.js
    noBannedAccounts                : "✅ Currently, there are no banned accounts in this server.",
    bannedAccountsList              : "**List of banned accounts by bot in the server:**",
    notYourButton                   : "❌ This button is not for you.",

    // events/commands/addWhitelist.js
    addWhitelistDescription         : "Add a user to the whitelist to bypass auto-ban checks.",
    addWhitelistUserDescription     : "The user to add to the whitelist.",
    whitelistAdded                  : "✅ Added {user} to the whitelist.",
    whitelistAlreadyExists          : "⚠️ {user} is already in the whitelist.",

    // events/commands/deleteWhitelist.js
    deleteWhitelistDescription      : "Remove a user from the whitelist.",
    deleteWhitelistUserDescription  : "The user to remove from the whitelist.",
    whitelistRemoved                : "✅ Removed {user} from the whitelist.",
    whitelistNotFound               : "⚠️ {user} is not in the whitelist.",

    // events/commands/getWhitelist.js
    getWhitelistDescription         : "Display the whitelist for the current server.",
    noWhitelistedAccounts           : "✅ Currently, there are no whitelisted accounts in this server.",
    whitelistedAccountsList         : "**Whitelist for this server:**",

    // events/commands/checkPerm.js
    permViewChannel                 : "View Channel",
    permSendMessages                : "Send Messages",
    permReadMessageHistory          : "Read Message History",
    permAddReactions                : "Add Reactions",
    permManageMessages              : "Manage Messages",
    permBanMembers                  : "Ban Members",
    botPermissionInChannel          : "**Bot's permissions in channel <#{channel}>:**",

    // events/commands/banTest.js
    testingAutoBan                  : "🚧 Testing auto ban...",
    testNormalModeDone              : "✅ Normal mode test completed.",
    testingMultiChannelSpam         : "🚧 Testing multi-channel spam...",
    needAtLeast3Channels            : "⚠️ Need at least 3 channels to test.",
    testMultiChannelDone            : "✅ Multi-channel spam test completed.",
    noBannedChannelSetup            : "⚠️ No banned channel configured. Please run `/setup` first.",
    bannedChannelNotFound           : "⚠️ Banned channel not found. Please run `/setup` again.",

     // events/commands/addAdmin.js
    addAdminDescription             : "Add an admin or moderator to the contact list for banned users.",
    addAdminUserDescription         : "The user to add as admin/moderator.",
    adminAdded                      : "✅ Added {user} as admin/moderator.",
    adminAlreadyExists              : "⚠️ {user} is already an admin/moderator.",

    // events/commands/deleteAdmin.js
    deleteAdminDescription          : "Remove an admin or moderator from the contact list.",
    deleteAdminUserDescription      : "The user to remove from admin/moderator list.",
    adminRemoved                    : "✅ Removed {user} from admin/moderator list.",
    adminNotFound                   : "⚠️ {user} is not in the admin/moderator list.",

    // events/commands/ban.js
    manualBanDescription            : "Directly ban a user from the current server.",
    manualBanUserDescription        : "The user to ban.",
    manualBanReason                 : "Manual ban by administrator",
    manualBanNoMessage              : "User was banned manually by slash command.",
    manualBanSuccess                : "✅ Banned {user} successfully.",
    manualBanAlreadyBanned          : "⚠️ {user} is already banned.",
    manualBanError                  : "❌ Error in ban command: {error}",

    // events/commands/unban.js
    manualUnbanDescription          : "Directly unban a user from the current server using the stored ban-list username.",
    manualUnbanUsernameDescription  : "Username of the banned user (e.g., username#1234)",
    manualUnbanSuccess              : "✅ Unbanned {username} successfully.",
    manualUnbanError                : "❌ Error in unban command: {error}",

    // events/commands/adminList.js
    getAdminListDescription         : "List all admins/moderators for the server.",
    noPermissionToViewAdmins        : "❌ You do not have permission to view the admin/moderator list.",
    adminListTitle                  : "Admin/Moderator List",
    adminListDescription            : "List of admins/moderators for ban message:",
    noAdminsAvailable               : "No admins/mods available for ban message.",
    adminField                      : "Admins/Moderators",
    totalAdmins                     : "Total: {count}",
    adminListCommandError           : "❌ Error in adminList command: ",

    // events/_banManager.js
    banReasonSpam                   : "Bot spam",
    banReasonBannedChannel          : "Send message on auto ban channel",
    deletedFiles                    : "📎 File from {tag} ({id})",
    downloadFilesErrorLog           : "Cannot download file {att.url}:",
    downloadFilesError              : "⚠️ Cannot download file from {message.author.tag}: ",
    yourDeletedFiles                : "📎 Your attachment: {name}",
    sendDMFilesErrorLog             : "⚠️ Could not send attachment to {tag} via DM: ",
    noMessageContent                : "No message content.",
    userField                       : "User",
    reasonField                     : "Reason",
    messageContentField             : "Message Content",
    channelField                    : "Channel",
    serverField                     : "Server",
    contactAdminsField              : "Contact Admins/Mods",
    noAdminsAvailable               : "No admins/mods available for contact.",
    youBannedTitle                  : "🚫 You Have Been Banned",
    userBannedTitle                 : "🚫 User Banned",
    youBannedDescription            : "You have been banned from the server {serverName} for spamming.",
    cannotSendDM                    : "⚠️ Could not send DM to banned user {message.author.tag}: ",
    deletedMessagesLog              : "🧹 Deleted {count} messages from {username} in channel #{channelName}.",
    deleteError                     : "⚠️ Failed to delete messages in #{channelName}: ",
    cannotBanUserTitle              : "⚠️ Cannot Ban User",
    cannotBanUserNotify             : "❌ Unable to ban user {username} in channel #{channelName}. Please check the bot's permissions.",
    errorField                      : "Error",

    // events/messageCreate.js
    banSuccessLog                   : "🚫 Banned {username} in server {guildId}.",
    cannotBanUserLog                : "❌ Unable to ban {username}: ",
    messageCreateError              : "❌ Error in MessageCreate: ",
    spamWarningChannel              : "⚠️ {user}, you are close to being banned for spamming. One more spam message and you'll be banned!",
    spamWarningDM                   : "⚠️ Warning: You are close to being banned from {serverName} for spamming. Please stop spamming to avoid a ban.",

    // events/commands/getBanInfo.js
    getBanInfoDescription           : "Get detailed ban information of a user.",
    getBanInfoUsernameDescription   : "Username of the banned user (e.g., username#1234)",
    getBanInfoTitle                 : "Ban Information",
    getBanInfoUserField             : "User",
    getBanInfoDisplayNameField      : "Display Name",
    getBanInfoIdField               : "User ID",
    getBanInfoTimeField             : "Ban Time",
    getBanInfoReasonField           : "Reason",
    getBanInfoMessageField          : "Last Banned Message",
    getBanInfoNotFound              : "❌ User `{username}` is not in the banned list of this server.",
    getBanInfoError                 : "❌ Error retrieving ban information: {error}",

    // events/commands/deleteBanData.js
    deleteBanDataDescription        : "Delete all stored Auto-Ban data for a user.",
    deleteBanDataUserDescription    : "The user whose stored bot data should be deleted.",
    deleteBanDataNoPermission       : "❌ You do not have permission to delete stored user data.",
    deleteBanDataSuccess            : "✅ Deleted stored data for {user}.\nTotal records removed: {total}\n- Ban records: {bannedRecords}\n- Whitelist entries: {whitelistRecords}\n- Admin contact entries: {adminRecords}\n- Farm data records: {farmDataRecords}\n- Farm enable/disable entries: {farmServerRecords}\n- Raid incident references: {raidIncidentRecords}",
    deleteBanDataError              : "❌ Error deleting stored user data: {error}",

    // events/commands/help.js
    helpTitle                       : "Auto-Ban Bot - Command List",
    helpDescription                 : "All available commands and their functions:",
    helpSetupName                   : "/setup <channel to ban> [notify channel]",
    helpSetupValue                  : "Setup the bot by specifying which channel will trigger auto-ban and where to send notifications. If notify channel is not provided, it will use the banned channel.",
    helpCheckPermName               : "/checkperm [channel]",
    helpCheckPermValue              : "Check if the bot has the required permissions in a specific channel. If no channel is provided, checks the current channel.",
    helpBanListName                 : "/getbanlist",
    helpBanListValue                : "Display a paginated list of all users who have been banned by this bot in the current server.",
    helpAddWhitelistName            : "/addwhitelist <user>",
    helpAddWhitelistValue           : "Add a user to the whitelist so the auto-ban pipeline ignores their messages.",
    helpDeleteWhitelistName         : "/deletewhitelist <user>",
    helpDeleteWhitelistValue        : "Remove a user from the whitelist.",
    helpGetWhitelistName            : "/getwhitelist",
    helpGetWhitelistValue           : "Display the current whitelist for the server.",
    helpAddAdminName                : "/addadmin <user>",
    helpAddAdminValue               : "Add an admin or moderator to the contact list that will be shown in ban messages sent to users.",
    helpDeleteAdminName             : "/deleteadmin <user>",
    helpDeleteAdminValue            : "Remove an admin or moderator from the contact list.",
    helpAdminListName               : "/getadminlist",
    helpAdminListValue              : "Display the list of admins/moderators who are available for contact in ban messages.",
    helpBanName                     : "/ban <user>",
    helpBanValue                    : "Directly ban a user and persist the ban record into the shared banned account list.",
    helpUnbanName                   : "/unban <username>",
    helpUnbanValue                  : "Unban a user by the stored username key from the banned account list and remove the persisted ban record.",
    helpGetBanInfoName              : "/getbaninfo <username>",
    helpGetBanInfoValue             : "Get detailed ban information about a specific user, including ban time, reason, and last message.",
    helpDeleteBanDataName           : "/deletebandata <user>",
    helpDeleteBanDataValue          : "Delete all stored Auto-Ban data for a user from ban records, whitelist/admin contacts, and farm data. Admin only.",
    helpBanTestName                 : "/bantest [mode]",
    helpBanTestValue                : "Test the auto-ban functionality. Modes: 'normal' (single channel) or 'multichannel' (spam detection across 3+ channels). Admin only.",
    helpRaidName                    : "/raid setup|disable|status|incidents|test",
    helpRaidValue                   : "Configure real-time join-raid detection, quarantine, campaign enforcement, incident review, and safe alert testing. Admin only.",
    helpPrivacyName                 : "/privacy",
    helpPrivacyValue                : "Show how message, member, attachment, evidence, and raid incident data are processed and retained.",
}

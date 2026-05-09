# Auto-Ban Event And Runtime Pipeline

## 1. Startup pipeline

Startup begins in `index.js` and runs in the following order:

1. Initialize the logger.
2. Load the bot config for the current instance.
3. Create a lockfile using `botId`.
4. Create the Discord client.
5. Register slash commands globally.
6. Attach handlers for `InteractionCreate` and `MessageCreate`.
7. `client.login(token)`.
8. Once the bot is online:
	- Log the bot tag.
	- Perform the initial `priceHistory` update.

Background jobs:

- Every 6 hours: `priceHistoryManager.updatePriceHistory()`.
- Every 12 hours: count how many servers have been configured via `/setup`.

## 2. InteractionCreate pipeline

`events/interactionCreate.js` only handles `chat input command` interactions.

Current routing:

```text
/help        -> helpCommand
/setup       -> setupCommand
/getbanlist  -> banListCommand
/checkperm   -> checkPermCommand
/bantest     -> banTestCommand
/addadmin    -> addAdminCommand
/deleteadmin -> deleteAdminCommand
/getadminlist -> adminList
/addwhitelist -> addWhitelistCommand
/deletewhitelist -> deleteWhitelistCommand
/getwhitelist -> getWhitelistCommand
/ban         -> banCommand
/unban       -> unbanCommand
/getbaninfo  -> getBanInfoCommand
/farm        -> farmEnableCommand | farmPrefixCommand
```

If a command or subcommand is invalid, the bot replies with an ephemeral error message.

### Important characteristics

- Commands are registered using `REST.put(Routes.applicationCommands(botId), { body })`.
- Registration is performed as global commands, not guild-scoped commands.
- Some commands declare `DefaultMemberPermissions.Administrator`, while others enforce authorization inside the command handler itself.

## 3. MessageCreate pipeline

`events/messageCreate.js` is the most important execution path in the bot. The current runtime order is:

```text
MessageCreate
	|
	+-- loadServerConfig()
	+-- loadBannedAccounts()
	+-- loadBotConfig()
	+-- new SpamDetector(botConfig)
	+-- new BanManager(client)
	|
	+-- ignore if not in guild
	+-- handleFarmMessage(message)
	|     \-- return early if a farm command handled the message
	|
	+-- settings = serverConfig[guildId]
	+-- return if `/setup` has not been completed yet
	+-- return if author.id is in settings.whitelist
	|
	+-- spamResult = detectMultiChannelSpam(message)
	+-- isBannedChannel = isSpamInBannedChannel(message, serverConfig)
	|
	+-- if warning threshold is reached -> send channel warning + DM warning
	|
	+-- return if the message is neither spam nor posted in the banned channel
	|
	+-- notifyUserBan()
	+-- banUser()
	+-- notifyBan()
	+-- deleteUserMessages() if botConfig.deleteMessage = true
```

### Key observations

- Farm messages are handled before moderation. If the user has farm mode enabled and the message matches the farm prefix, moderation stops for that message.
- The bot does not moderate DMs and does not moderate servers that do not yet have an entry in `serverConfig.json`.
- The whitelist short-circuits the moderation path before spam detection and banned-channel checks run.
- `serverConfig[guildId]` can now exist before `/setup` because admin and whitelist commands may create the entry, so moderation still requires `bannedChannelId` to be configured.
- `loadServerConfig()` is a synchronous read and is called for every incoming message.

## 4. Spam detection pipeline

`events/_spamDetector.js` stores `messageHistory` in process memory:

- Key: `userId`
- Value: a list of `{ channelId, content, timestamp }`

Algorithm:

1. Ignore empty messages.
2. Append the new message to the user's history.
3. Trim the history to the configured `spamWindowMs` time window.
4. Find all distinct channels where the user posted the same `content`.
5. Compare the distinct channel count against `channelSpamThreshold`.

Return values:

- `null`: no spam signal was detected.
- `{ isSpam: false, warning: true, channels }`: the user has just reached the warning threshold, equal to `threshold - 1` channels.
- `{ isSpam: true, warning: false, channels }`: the user is classified as multi-channel spam.

After a successful spam detection, that user's history is cleared to reset the detection cycle.

### Banned channel shortcut

In addition to multi-channel spam detection, the bot also auto-bans if:

- `message.channel.id === settings.bannedChannelId`

The helper is named `isSpamInBannedChannel`, but semantically it is an auto-ban rule for a banned channel.

## 5. Warning pipeline

If a user reaches the spam warning threshold:

1. The bot replies in-channel with a warning that the next spam action will trigger a ban.
2. The warning reply is deleted after 10 seconds.
3. The bot also attempts to send a DM warning.

If the DM cannot be delivered, the bot only logs a warning and continues execution.

## 6. Ban pipeline

When a message satisfies either of the following conditions:

- multi-channel spam
- posting inside the banned channel

`BanManager` executes the following sequence:

1. `notifyUserBan(message, settings, extraChannels, isBannedChannel)`
	- Build a DM embed for the user.
	- Include the admin/mod contact list if `settings.admins` exists.
	- Attempt to re-upload attachments through DM.
2. `banUser(message, bannedAccounts, isBannedChannel)`
	- Call `guild.members.ban(userId, { reason })`.
	- Persist the ban record into `bannedAccountsServers.json` using `message.author.tag` as the key.
3. `notifyBan(message, settings, extraChannels, isBannedChannel)`
	- Send an embed into `notifyChannelId`, or fall back to `bannedChannelId` if no notify channel is configured.
	- Attempt to re-upload attachments into the notify channel.
4. `deleteUserMessages(message, botConfig, extraChannels)` if enabled.

### Persisted ban record structure

Each banned user is stored as:

```json
{
  "displayName": "...",
  "id": "...",
  "time": "ISO timestamp",
  "lastBannedMessage": "...",
  "reason": "Bot spam | Send message on auto ban channel"
}
```

### Message deletion policy

If `botConfig.deleteMessage = true`:

- The bot fetches up to 100 recent messages from each target channel.
- It only deletes messages from the banned user that fall within `now - timeDeleteMessage`.
- For multi-channel spam, target channels are the detected spam channels.
- For banned-channel bans, target channels expand to the full guild channel cache.

## 7. Error pipeline

If the ban flow fails:

- `messageCreate.js` logs the failure through `cannotBanUserLog`.
- `BanManager.notifyBanError()` sends a warning embed to the notify channel if the bot has permission.

General event-level error handling:

- `messageCreate.js` wraps the whole pipeline in `try/catch`.
- `index.js` listens for `unhandledRejection` and `uncaughtException`.

## 8. Farm pipeline injected into MessageCreate

`events/farmMessageHandler.js` is invoked before moderation.

Conditions for treating a message as a farm command:

1. The message must originate from a guild.
2. The sender must not be a bot.
3. `farmManager.isFarmingEnabled(userId, guildId)` must return `true`.
4. The message must start with the server prefix, which defaults to `h`.

Once these conditions are met, the bot parses the text command and routes it as follows:

```text
help | h                -> handleFarmHelp
login | daily           -> handleFarmLogin
status | stats | farm   -> handleFarmStatus
grow | plant            -> handleFarmGrow
harvest | reap          -> handleFarmHarvest
crop [list]             -> handleCropList / handleFarmInfo
sell                    -> handleFarmSell
buy | purchase          -> handleFarmBuy
expand                  -> handleFarmExpand
role list               -> handleRoleList
role buy                -> handleRoleBuy
```

If the farm command is handled successfully, the handler returns `true` so that `messageCreate` stops immediately.

## 9. Command-specific behavior summary

### `/setup`

- Create or overwrite `serverConfig[guildId]`.
- If `notifychannel` is omitted, the bot uses `channeltoban` as the notify channel.

### `/getbanlist`

- Read `bannedAccountsServers.json` for the current guild.
- Display 10 users per page.
- Use `prev/next` buttons for pagination over a 5-minute interaction window.

### `/getadminlist`

- Read `settings.admins` from `serverConfig.json`.
- Display the admin/mod contact list in an ephemeral embed.

### `/addwhitelist`, `/deletewhitelist`, `/getwhitelist`

- Manage `settings.whitelist` inside `serverConfig.json`.
- The whitelist stores Discord user IDs and is evaluated before the moderation pipeline.
- `/getwhitelist` mirrors the paginated list behavior used by `/getbanlist`.

### `/ban`

- Directly ban a selected guild user.
- Persist a manual ban record into `bannedAccountsServers.json` using the same structure as the auto-ban flow.

### `/unban`

- Resolve the ban entry by the stored `username#1234` key from `bannedAccountsServers.json`.
- Unban the stored user ID from the guild when the Discord ban still exists.
- Remove the persisted record even if the guild ban has already been cleared out-of-band.

### `/getbaninfo`

- Look up the ban record using the stored `username#discriminator` tag key.
- Display the timestamp, reason, user ID, display name, and last banned message.

### `/farm enable|disable`

- Enable or disable farm mode per user within a guild.

### `/farm prefix`

- Change the message-command prefix for the entire guild.

## 10. Short pipeline summary

```text
Startup
  -> load config
  -> setup lockfile
  -> register commands
  -> attach events
  -> login

InteractionCreate
  -> slash router
  -> command handler

MessageCreate
  -> farm router
  -> moderation settings lookup
  -> spam / banned-channel detection
  -> warning or ban
  -> persist records + notify + cleanup
```


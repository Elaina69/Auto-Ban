# Auto-Ban Event And Runtime Pipeline

## 1. Startup pipeline

Startup begins in `index.js` and runs in the following order:

1. Initialize the logger.
2. Recover runtime JSON config files from last-good copies or zip backups.
3. Load the bot config for the current instance.
4. Create a startup zip backup of the full `configs/` directory.
5. Create a lockfile using `botId`.
6. Create the Discord client.
7. Register slash commands globally.
8. Attach handlers for `InteractionCreate`, `MessageCreate`, and guild member add/update/remove events.
9. `client.login(token)`.
10. Once the bot is online:
	- Log the bot tag.
	- Perform the initial `priceHistory` update.

Background jobs:

- Every 6 hours: `priceHistoryManager.updatePriceHistory()`.
- Every 12 hours: count how many servers have been configured via `/setup`.
- Every 12 hours: remove expired moderation evidence and raid incident summaries.
- Every 7 days: create `_backup/yyyy-mm-dd_hh-mm-ss.zip`.

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
/deletebandata -> deleteBanDataCommand
/raid        -> raidCommand
/privacy     -> privacyCommand
/farm        -> farmSlashCommand
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
	+-- ignore if not in guild or sent by a bot
	|
	+-- settings = serverConfig[guildId]
	+-- return unless auto-ban channel or raid protection is configured
	+-- return if author.id is in settings.whitelist
	|
	+-- spamResult = detectMultiChannelSpam(message)
	+-- isBannedChannel = isSpamInBannedChannel(message, serverConfig)
	+-- raidResult = RaidDetector.handleMessage(message) when enabled
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

- The bot does not moderate DMs and does not moderate servers that do not yet have an entry in `serverConfig.json`.
- The bot does not process farm gameplay inside `messageCreate`; farm is now slash-only.
- The whitelist short-circuits the moderation path before spam detection and banned-channel checks run.
- `serverConfig[guildId]` can exist before `/setup`; content processing requires either `bannedChannelId` or enabled raid protection.
- `loadServerConfig()` is a synchronous read and is called for every incoming message.

## 4. Spam detection pipeline

`events/_spamDetector.js` stores `messageHistory` in process memory:

- Key: `guildId:userId`
- Value: a list of `{ channelId, fingerprint, timestamp }`
- Fingerprint: HMAC-SHA-256 of normalized content using the host data key; raw text is not stored in message history.

Algorithm:

1. Ignore empty messages.
2. Normalize content, remove zero-width formatting characters, and create a keyed fingerprint.
3. Append the fingerprint to guild-scoped history and schedule TTL cleanup.
4. Trim history to the configured `spamWindowMs` time window.
5. Find all distinct channels where the user posted the same fingerprint.
6. Compare the distinct channel count against `channelSpamThreshold`.

Return values:

- `null`: no spam signal was detected.
- `{ isSpam: false, warning: true, channels }`: the user has just reached the warning threshold, equal to `threshold - 1` channels.
- `{ isSpam: true, warning: false, channels }`: the user is classified as multi-channel spam.

After a successful spam detection, that user's history is cleared to reset the detection cycle.

### Banned channel shortcut

In addition to multi-channel spam detection, the bot also auto-bans if:

- `message.channel.id === settings.bannedChannelId`

The helper is named `isSpamInBannedChannel`, but semantically it is an auto-ban rule for a banned channel.

### Join-raid correlation

`GuildMemberAdd` opens an incident when a configurable join burst threshold is reached, then optionally quarantines the cohort. `GuildMemberUpdate` handles membership-screening release and protected-role removal; `GuildMemberRemove` cleans transient state.

During an active incident, `MessageCreate` correlates one HMAC fingerprint across distinct cohort accounts and channels. `alert` only notifies, `quarantine` applies the configured role, and `enforce` bans only the account whose message completes all campaign thresholds. Join velocity or account age alone never causes a ban. Encrypted incident summaries are stored in `raidIncidents.json`; live cohorts and campaign fingerprints remain in RAM.

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

1. `notifyUserBan(message, settings, extraChannels, isBannedChannel, botConfig)`
	- Build a DM embed for the user.
	- Include the admin/mod contact list if `settings.admins` exists.
	- Re-upload attachments through DM only when `botConfig.reuploadModerationAttachments = true`.
2. `banUser(message, bannedAccounts, isBannedChannel, botConfig)`
	- Call `guild.members.ban(userId, { reason })`.
	- Persist the ban record into `bannedAccountsServers.json` using `message.author.tag` as the key.
3. `notifyBan(message, settings, extraChannels, isBannedChannel, botConfig)`
	- Send an embed into `notifyChannelId`, or fall back to `bannedChannelId` if no notify channel is configured.
	- Re-upload attachments into the notify channel only when `botConfig.reuploadModerationAttachments = true`.
4. `deleteUserMessages(message, botConfig, extraChannels)` if enabled.

### Persisted ban record structure

Each banned user is stored as:

```json
{
  "displayName": "...",
  "id": "...",
  "time": "ISO timestamp",
  "lastBannedMessage": "...",
  "reason": "Bot spam | Send message on auto ban channel | Coordinated join-raid message campaign",
  "contentFingerprint": "HMAC hex when available",
  "incidentId": "optional raid incident ID",
  "messageIds": ["..."],
  "channelIds": ["..."],
  "evidenceExpiresAt": "ISO timestamp"
}
```

`lastBannedMessage` follows `banMessageContentPolicy`; the default is a short moderation snippet. The snippet, fingerprint, and message/channel IDs are removed after `banEvidenceRetentionDays`, while minimal ban identity/reason fields remain for review and unban.

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

## 8. Farm slash-command pipeline

Farm gameplay is handled through `/farm` subcommands in `events/commands/farm/slash.js`.
No farm path reads `message.content`.

The slash router creates a lightweight message adapter so the existing farm gameplay handlers can reuse their reply/embed logic. Inputs come from interaction options:

```text
/farm help              -> handleFarmHelp
/farm login             -> handleFarmLogin
/farm status [user]     -> handleFarmStatus
/farm grow crop         -> handleFarmGrow
/farm harvest           -> handleFarmHarvest
/farm crops [sort]      -> handleCropList
/farm info [crop]       -> handleFarmInfo
/farm sell crop amount  -> handleFarmSell
/farm buy crop quantity -> handleFarmBuy
/farm expand            -> handleFarmExpand
/farm role-list         -> handleRoleList
/farm role-buy role     -> handleRoleBuy
```

`/farm enable` and `/farm disable` keep the per-user enable state. Disabled users receive an ephemeral reminder to run `/farm enable`.

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

### `/deletebandata`

- Delete a selected user's stored data across all guild configs managed by the bot.
- Remove matching ban records from `bannedAccountsServers.json` by user ID or stored username key.
- Remove the user ID from `serverConfig.json` whitelist and admin contact lists.
- Remove the user's farm progression from `farmData.json`.
- Remove the user's farm enable/disable entries from `farmServerConfig.json`.
- Restricted to administrators through default slash-command permissions and an in-handler permission check.

### `/farm enable|disable`

- Enable or disable farm mode per user within a guild.

### `/farm gameplay`

- `/farm help`, `/farm login`, `/farm status`, `/farm grow`, `/farm harvest`, `/farm sell`, `/farm buy`, `/farm expand`, `/farm crops`, `/farm info`, `/farm role-list`, and `/farm role-buy` run the full farm mini-game without prefix text commands.

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
  -> moderation settings lookup
  -> spam / banned-channel detection
  -> warning or ban
  -> persist records + notify + cleanup
```


# Auto-Ban Structure

## Repository Goal

`Auto-Ban` is a Discord bot built with Node.js and Discord.js v14. It currently has three primary feature groups:

- Automatic banning for users who trigger multi-channel spam detection or post inside a banned channel.
- Real-time join-raid detection correlated with coordinated message campaigns.
- A slash-command farming mini-game that is independent of message content.

The repository follows a compact layout: `index.js` bootstraps the bot, `events/` handles Discord event flow, `utils/` contains reusable logic, `configs/` stores JSON data and the language pack, and `logs/instance-<n>/` stores per-instance daily log files.

## Root Directory

```text
Auto-Ban/
|- index.js                    # Entry point
|- Dockerfile                  # Ubuntu/Node/PM2 image for Docker mode
|- package.json                # Dependencies, ESM mode
|- _instance-utils.sh          # Bash helper for resolving BOT_INSTANCES
|- _create-pm2-session.sh      # Creates one PM2 app per resolved instance
|- _create-tmux-session.sh     # Creates tmux session autoban
|- _create-docker-image.sh     # Builds Docker image autoban
|- _create-docker-container.sh # Creates Docker container autoban-container
|- _run.sh                     # Host-mode tmux/PM2 launcher
|- _run(docker).sh             # Docker-mode tmux/PM2 launcher
|- start-bot.sh                # Compatibility wrapper around _run.sh
|- tmux.sh                     # Attach helper for tmux session autoban
|- configs/                    # Configuration and persisted JSON data
|- _backup/                    # Runtime config backups, last-good copies, recovery quarantine
|- events/                     # Event handlers and command handlers
|- utils/                      # Config, logger, farm, crop, lockfile, formatter
|- logs/                       # Per-instance daily log files
|- _docs/                      # Internal documentation
|- README.md                   # High-level overview
|- TODO.md                     # Task notes
```

## Entry point

`index.js` executes the full startup sequence:

1. Resolve `BOT_INSTANCE`, initialize `Logger`, and hook `console` output into `logs/instance-<n>/`.
2. Recover runtime JSON config files through `backupManager.recoverConfigs()`.
3. Load the bot config via `configManager.loadBotConfig()`.
4. Create a startup zip backup of `configs/` in `_backup/` only when this process is the backup owner.
5. Create a lockfile keyed by `botId` to prevent duplicate processes.
6. Instantiate the Discord `Client` with the following intents:
	- `Guilds`
	- `GuildMessages`
	- `MessageContent`
	- `GuildMembers`
	Intent note: `MessageContent` supports cross-channel/cross-account moderation; `GuildMembers` supports join/update/leave raid state. Farm gameplay uses neither content nor member enumeration.
7. Register slash commands globally through `registerCommands(token, botId)`.
8. Attach event listeners:
	- `InteractionCreate` -> `HandleInteractionCreate`
	- `MessageCreate` -> `handleMessageCreate`
	- `GuildMemberAdd/Update/Remove` -> `guildMemberEvents.js` -> `RaidDetector`
9. Log in the bot.
10. Once `ClientReady` fires, perform the initial `priceHistory` update.
11. Run lightweight scheduled jobs using `setInterval`:
	- Every 6 hours: update `priceHistory.json`
	- Every 12 hours: print the number of configured servers from `serverConfig.json`
	- Every 12 hours: prune expired ban evidence and raid incidents
	- Every 7 days: the backup owner writes a full config backup zip to `_backup/`

## Events Directory

```text
events/
|- interactionCreate.js        # Slash-command router
|- commands.js                 # Slash-command registration via Discord REST API
|- messageCreate.js            # Moderation pipeline
|- _spamDetector.js            # Multi-channel spam detection
|- _raidDetector.js            # Join cohorts, quarantine, campaign correlation, incidents
|- guildMemberEvents.js        # Guild member lifecycle wrappers
|- _banManager.js              # Ban, DM, notify, message deletion, attachment reupload
|- commands/
	|- help.js
	|- setup.js
	|- banList.js
	|- checkPerm.js
	|- banTest.js
	|- addAdmin.js
	|- deleteAdmin.js
	|- addWhitelist.js
	|- deleteWhitelist.js
	|- getWhitelist.js
	|- adminList.js
	|- ban.js
	|- unban.js
	|- getBanInfo.js
	|- deleteBanData.js
	|- raid.js
	|- privacy.js
	|- farm/
		|- slash.js
		|- enable.js
		|- help.js
		|- login.js
		|- status.js
		|- grow.js
		|- harvest.js
		|- info.js
		|- cropList.js
		|- sell.js
		|- buy.js
		|- expand.js
		|- roleShop.js
```

### Moderation Slash Command Group

- `/help`: display the command list.
- `/setup`: persist `bannedChannelId` and `notifyChannelId` for the current server.
- `/getbanlist`: display the list of users banned by the bot in the current server.
- `/checkperm`: inspect the bot's permissions in a channel.
- `/bantest`: test the auto-ban flow.
- `/addadmin`: add an admin/mod to the contact list shown in ban DMs.
- `/deleteadmin`: remove an admin/mod from the contact list.
- `/getadminlist`: display the current admin/mod list.
- `/addwhitelist`, `/deletewhitelist`, `/getwhitelist`: manage the per-guild whitelist used to bypass auto-ban checks.
- `/ban`, `/unban`: manually manage guild bans while keeping `bannedAccountsServers.json` synchronized.
- `/getbaninfo`: retrieve a detailed ban record by username tag.
- `/deletebandata`: delete a selected user's stored bot data from ban records, whitelist/admin contacts, and farm data.
- `/raid setup|disable|status|incidents|test`: configure and inspect join-raid protection.
- `/privacy`: display the active data processing and retention policy.

### Farm Group

- The `/farm` slash command owns the full mini-game and no longer uses message-prefix commands.
- Current subcommands include `enable`, `disable`, `help`, `login`, `status`, `grow`, `harvest`, `sell`, `buy`, `expand`, `crops`, `info`, `role-list`, and `role-buy`.
- `events/commands/farm/slash.js` adapts slash interactions to the existing farm gameplay handlers without reading `message.content`.

## Utils Directory

```text
utils/
|- configManager.js            # Bot config, server config, banned accounts
|- farmManager.js              # Farm data, enable state, login/grow/harvest/sell
|- cropManager.js              # Crop lookup, 6-hour price calculation, time formatting
|- priceHistoryManager.js      # Stores the latest 5 days of price history
|- logger.js                   # Persists console output to daily log files
|- lockfile.js                 # Prevents duplicate startup for the same botId
|- runtimeInstance.js          # Validates BOT_INSTANCE and backup-owner env values
|- formatLang.js               # String template formatter
|- userDataManager.js          # Cross-config user data deletion helper
```

## Configs Directory

```text
configs/
|- botConfig.1.json            # Instance 1 config
|- botConfig.2.json            # Instance 2 config
|- serverConfig.json           # Auto-ban settings per guild
|- bannedAccountsServers.json  # Ban history per guild
|- raidIncidents.json          # Encrypted, expiring raid incident summaries
|- farmServerConfig.json       # Farm enable state per guild, plus legacy prefix data
|- farmData.json               # Farm progression per user
|- crops.js                    # Crop definitions
|- priceHistory.json           # Crop price history in 6-hour buckets
|- lang.js                     # UI and log strings
```

## Data Scope And Sharing Model

- `botConfig.<instance>.json`: isolated per bot process, selected through the `BOT_INSTANCE` environment variable.
- `serverConfig.json`: shared across instances.
- `bannedAccountsServers.json`: shared across instances.
- `raidIncidents.json`: shared encrypted incident summaries; live detector state remains process-local.
- `farmServerConfig.json`: shared across instances.
- `farmData.json`: shared across instances and keyed by `userId`.
- `priceHistory.json`: shared across instances.

Notes:

- Runtime JSON files now use `safeJsonStore`: AES-256-GCM encryption at rest, per-file locks, temp writes, file fsync, atomic rename, and encrypted last-good copies.
- `AUTO_BAN_DATA_KEY` can provide the encryption key. If it is not set, the bot generates a local key in `_backup/_keys/data-encryption-key`.
- Parent directory fsync can be enabled with `AUTO_BAN_FSYNC_DIR=1` on native filesystems that support it reliably.
- Startup recovery restores missing/empty/invalid JSON from `_backup/_last-good/` first, then from the newest `_backup/*.zip`.
- In multi-instance script mode, only `AUTO_BAN_BACKUP_OWNER` writes `_backup/yyyy-mm-dd_hh-mm-ss.zip` on startup and every 7 days while running.
- Without `AUTO_BAN_BACKUP_OWNER`, a direct `node index.js` run keeps legacy single-process backup behavior.
- `serverConfig.json` holds auto-ban channel settings, admin contacts, whitelist IDs, and opt-in `raidProtection` settings.

## Multi-Instance Support

The current codebase supports running multiple bot instances from the same repository:

- `BOT_INSTANCE=1` -> load `configs/botConfig.1.json`
- `BOT_INSTANCE=2` -> load `configs/botConfig.2.json`

The helper scripts start one PM2 process per resolved instance:

- `BOT_INSTANCES=1,2` -> create `autoban-1` and `autoban-2`
- If `BOT_INSTANCES` is unset, `_instance-utils.sh` auto-detects `configs/botConfig.<n>.json`
- Missing config files fail early before PM2 starts, which prevents hidden prompts inside tmux/Docker

Each process receives its own `BOT_INSTANCE`, creates its own lockfile keyed by `botId` in the repository root, and writes logs under `logs/instance-<n>/`.

Docker mode uses one shared container:

- Image: `autoban`
- Container: `autoban-container`
- Workdir: `/Auto-Ban`
- PM2 apps inside the container: `autoban-<instance>`

## Logging And Runtime Operations

- `Logger` writes every `console.log`, `console.warn`, and `console.error` entry into `logs/instance-<n>/DD-MM-YYYY.txt`.
- Every log line includes `[instance:<n>]`.
- Runtime logs include startup, command registration, successful bans, failed ban attempts, message deletion errors, and price history updates.
- `process.on('unhandledRejection')` and `process.on('uncaughtException')` are registered to avoid silent process failures.

## High-Level Pipeline

```text
Discord Event
	|
	+-- InteractionCreate -> slash command router -> command handler
	|
	+-- MessageCreate
			|
			+-- moderation config lookup
			|
			+-- SpamDetector / banned channel check
			|
			+-- BanManager: DM -> ban -> notify -> delete messages
```

## Best Files To Read For Onboarding

For a fast technical onboarding pass, this is the recommended reading order:

1. `index.js`
2. `events/messageCreate.js`
3. `events/_spamDetector.js`
4. `events/_banManager.js`
5. `events/interactionCreate.js`
6. `events/commands.js`
7. `utils/configManager.js`
8. `utils/farmManager.js`
9. `events/commands/farm/slash.js`


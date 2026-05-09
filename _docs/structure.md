# Auto-Ban Structure

## Repository Goal

`Auto-Ban` is a Discord bot built with Node.js and Discord.js v14. It currently has two primary feature groups:

- Automatic banning for users who trigger multi-channel spam detection or post inside a banned channel.
- A farming mini-game integrated into the `messageCreate` pipeline.

The repository follows a compact layout: `index.js` bootstraps the bot, `events/` handles Discord event flow, `utils/` contains reusable logic, `configs/` stores JSON data and the language pack, and `logs/` stores daily log files.

## Root Directory

```text
Auto-Ban/
|- index.js                    # Entry point
|- package.json                # Dependencies, ESM mode
|- start-bot.sh                # Startup script for PM2/tmux
|- tmux.sh                     # tmux helper script
|- configs/                    # Configuration and persisted JSON data
|- events/                     # Event handlers and command handlers
|- utils/                      # Config, logger, farm, crop, lockfile, formatter
|- logs/                       # Daily log files in DD-MM-YYYY.txt format
|- _docs/                      # Internal documentation
|- README.md                   # High-level overview
|- TODO.md                     # Task notes
```

## Entry point

`index.js` executes the full startup sequence:

1. Initialize `Logger` and hook `console` output into `logs/`.
2. Load the bot config via `configManager.loadBotConfig()`.
3. Create a lockfile keyed by `botId` to prevent duplicate processes.
4. Instantiate the Discord `Client` with the following intents:
	- `Guilds`
	- `GuildMessages`
	- `MessageContent`
	- `GuildMembers`
5. Register slash commands globally through `registerCommands(token, botId)`.
6. Attach event listeners:
	- `InteractionCreate` -> `HandleInteractionCreate`
	- `MessageCreate` -> `handleMessageCreate`
7. Log in the bot.
8. Once `ClientReady` fires, perform the initial `priceHistory` update.
9. Run lightweight scheduled jobs using `setInterval`:
	- Every 6 hours: update `priceHistory.json`
	- Every 12 hours: print the number of configured servers from `serverConfig.json`

## Events Directory

```text
events/
|- interactionCreate.js        # Slash-command router
|- commands.js                 # Slash-command registration via Discord REST API
|- messageCreate.js            # Moderation and farm pipeline
|- _spamDetector.js            # Multi-channel spam detection
|- _banManager.js              # Ban, DM, notify, message deletion, attachment reupload
|- farmMessageHandler.js       # Prefix-based farm command router
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
	|- farm/
		|- enable.js
		|- prefix.js
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

### Farm Group

- The `/farm` slash command is only used to enable/disable farm mode or update the prefix.
- Actual farm gameplay commands are processed through `messageCreate` using a text prefix, which defaults to `h`.
- Example commands: `h help`, `h login`, `h crop list`, `h buy tomato 10`, `h grow tomato`.

## Utils Directory

```text
utils/
|- configManager.js            # Bot config, server config, banned accounts
|- farmManager.js              # Farm data, prefix, enable state, login/grow/harvest/sell
|- cropManager.js              # Crop lookup, 6-hour price calculation, time formatting
|- priceHistoryManager.js      # Stores the latest 5 days of price history
|- logger.js                   # Persists console output to daily log files
|- lockfile.js                 # Prevents duplicate startup for the same botId
|- formatLang.js               # String template formatter
```

## Configs Directory

```text
configs/
|- botConfig.1.json            # Instance 1 config
|- botConfig.2.json            # Instance 2 config
|- serverConfig.json           # Auto-ban settings per guild
|- bannedAccountsServers.json  # Ban history per guild
|- farmServerConfig.json       # Farm prefix and enable state per guild
|- farmData.json               # Farm progression per user
|- crops.js                    # Crop definitions
|- priceHistory.json           # Crop price history in 6-hour buckets
|- lang.js                     # UI and log strings
```

## Data Scope And Sharing Model

- `botConfig.<instance>.json`: isolated per bot process, selected through the `BOT_INSTANCE` environment variable.
- `serverConfig.json`: shared across instances.
- `bannedAccountsServers.json`: shared across instances.
- `farmServerConfig.json`: shared across instances.
- `farmData.json`: shared across instances and keyed by `userId`.
- `priceHistory.json`: shared across instances.

Notes:

- `configManager` uses atomic writes for `serverConfig.json` and `bannedAccountsServers.json` to reduce the risk of file corruption when multiple processes write concurrently.
- The farm subsystem (`farmData.json`, `farmServerConfig.json`, `priceHistory.json`) still uses direct `fs.writeFileSync` writes and does not yet implement the same atomic rename strategy.
- `serverConfig.json` now holds three moderation-related per-guild slices: auto-ban channel settings, admin contacts, and the whitelist.

## Multi-Instance Support

The current codebase supports running multiple bot instances from the same repository:

- `BOT_INSTANCE=1` -> load `configs/botConfig.1.json`
- `BOT_INSTANCE=2` -> load `configs/botConfig.2.json`

`start-bot.sh` starts two separate PM2 processes and injects the corresponding `BOT_INSTANCE` value. Each process creates its own lockfile keyed by `botId` in the repository root.

## Logging And Runtime Operations

- `Logger` writes every `console.log`, `console.warn`, and `console.error` entry into `logs/DD-MM-YYYY.txt`.
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
			+-- farmMessageHandler (if the prefix matches and the user has farm mode enabled)
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
9. `events/farmMessageHandler.js`


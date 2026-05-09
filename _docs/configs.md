# Auto-Ban Config Reference

## 1. Overview

The bot currently relies on two major groups of configuration and persisted data:

- Startup and moderation configuration.
- Data and configuration for the farming mini-game.

Some files are per-instance, while others are shared across all bot processes in the same repository.

## 2. Environment Variables

### `BOT_INSTANCE`

`configManager.js` reads the `BOT_INSTANCE` environment variable to determine which bot config file should be loaded:

- `BOT_INSTANCE=1` -> `configs/botConfig.1.json`
- `BOT_INSTANCE=2` -> `configs/botConfig.2.json`
- If unset -> defaults to `1`

This allows multiple Discord bot instances to run with different credentials while still sharing the same moderation and farm logic.

## 3. Moderation Configuration Files

### `configs/botConfig.<instance>.json`

Purpose:

- Stores credentials and runtime settings for an individual bot process.

Actual schema:

```json
{
	"token": "Discord bot token",
	"botId": "Application ID / bot user ID",
	"deleteMessage": true,
	"timeDeleteMessage": 86400000,
	"spamWindowMs": 60000,
	"channelSpamThreshold": 4
}
```

Field descriptions:

- `token`: Discord login token.
- `botId`: used for slash-command registration and lockfile naming.
- `deleteMessage`: whether the bot should delete a user's messages after banning them.
- `timeDeleteMessage`: retrospective deletion window in milliseconds.
- `spamWindowMs`: time window for multi-channel spam detection.
- `channelSpamThreshold`: number of distinct channels required to classify a message pattern as spam.

If the file does not exist, `loadBotConfig()` prompts interactively in the terminal and creates a new one.

### `configs/serverConfig.json`

Purpose:

- Stores auto-ban settings on a per-guild basis.

Actual schema:

```json
{
	"<guildId>": {
		"bannedChannelId": "1234567890",
		"notifyChannelId": "1234567890",
		"admins": ["111", "222"],
		"whitelist": ["333", "444"]
	}
}
```

Notes:

- `admins` is not set by `/setup`; it is managed later through `/addadmin` and `/deleteadmin`.
- `whitelist` is managed through `/addwhitelist` and `/deletewhitelist` and stores Discord user IDs.
- If `notifyChannelId` is not provided during `/setup`, the bot assigns `bannedChannelId` as the notify channel.
- This file is shared across all instances.

### `configs/bannedAccountsServers.json`

Purpose:

- Stores ban history for users banned by the bot, grouped by guild.

Actual schema:

```json
{
	"<guildId>": {
		"username#1234": {
			"displayName": "Display Name",
			"id": "userId",
			"time": "2026-04-24T00:00:00.000Z",
			"lastBannedMessage": "message content",
			"reason": "Bot spam"
		}
	}
}
```

Notes:

- The second-level key is `message.author.tag`, not the user ID.
- `/getbanlist`, `/getbaninfo`, and `/unban` read from this file.
- `/ban` and the auto-ban pipeline both write into this file.
- This file is shared across all instances.

### `configs/lang.js`

Purpose:

- Contains all string resources for logs, embeds, replies, warnings, and command descriptions.

Role:

- Keeps UI/log text decoupled from handler logic.
- Is formatted through `utils/formatLang.js` using placeholders such as `{tag}`, `{count}`, and `{serverName}`.

## 4. Farm Configuration And Data Files

### `configs/farmServerConfig.json`

Purpose:

- Stores the farm prefix and per-user enable/disable state for each guild.

Actual schema:

```json
{
	"<guildId>": {
		"prefix": "h",
		"enabled": {
			"<userId>": true
		}
	}
}
```

Notes:

- If a guild does not yet have config, `farmManager.isFarmingEnabled()` defaults to `true`.
- The default prefix is `h`.
- This file is written via `fs.writeFileSync` and does not currently use atomic writes.

### `configs/farmData.json`

Purpose:

- Stores user farm progression.

Default schema created for a new user:

```json
{
	"<userId>": {
		"money": 5000,
		"experience": 0,
		"landSlots": 10,
		"inventory": {},
		"currentCrop": null,
		"plantedAt": null,
		"lastLogin": null
	}
}
```

Notes:

- The key is `userId` only, without `guildId`, so farm progression is shared across servers.
- In the current implementation, `currentCrop` stores the full crop object at planting time.

### `configs/crops.js`

Purpose:

- Defines the crop catalog for the farm system.

Schema for each crop:

```json
{
	"tomato": {
		"name": "Tomato",
		"displayName": "Tomato with emoji",
		"yield": 75,
		"growthTime": 14400000
	}
}
```

Fields:

- `name`: canonical display name.
- `displayName`: emoji-enhanced display label.
- `yield`: base output per land slot.
- `growthTime`: growth duration in milliseconds.

### `configs/priceHistory.json`

Purpose:

- Stores buy/sell price history in 6-hour buckets for charting and lookup.

Actual schema:

```json
{
	"lastUpdate": "YYYY-MM-DD-HH",
	"data": {
		"tomato": [
			{
				"timestamp": "YYYY-MM-DD-HH",
				"buy": 5.35,
				"sell": 2.81
			}
		]
	}
}
```

Rules:

- Each crop keeps at most 20 price points, equivalent to 5 days x 4 periods per day.
- Prices are updated in UTC+7 time.

## 5. Crop Pricing Rules

`utils/cropManager.js` applies the following rules:


- The sell price (`sell`) fluctuates between `$1` and `$10`.
- The buy price (`buy`) equals the sell price plus a markup between `$1` and `$3`.
- Prices are deterministic within each 6-hour period, based on crop name, time period, and a seeded random generator.
- The 6-hour periods in UTC+7 are:
	- `00:00-06:00`
	- `06:00-12:00`
	- `12:00-18:00`
	- `18:00-00:00`

## 6. Important Farm Rules

`utils/farmManager.js` currently enforces the following rules:

- Daily login can only be claimed once per day in UTC+7.
- The current daily reward is `10000` money.
- Land expansion follows the formula `20000 + (currentSlots * 5000)`.
- Overdue harvests lose `10%` yield per late hour.
- Harvest experience gained is `floor(actualYield / 10)`.

## 7. File Writes And Data Safety

### Existing atomic writes

`utils/configManager.js` currently uses atomic writes for:

- `serverConfig.json`
- `bannedAccountsServers.json`

Pattern:

1. Write to a randomly named `*.tmp` file.
2. Use `renameSync()` to replace the original file.

### Files without atomic writes yet

The following files are still written directly:

- `farmData.json`
- `farmServerConfig.json`
- `priceHistory.json`
- `botConfig.<instance>.json`

If the repository continues to run multiple instances that mutate farm data concurrently, this remains an operational caveat.

## 8. Command-To-Config Mapping

```text
/setup
	-> serverConfig.json

/addadmin, /deleteadmin
	-> serverConfig.json (field admins)


/addwhitelist, /deletewhitelist
	-> serverConfig.json (field whitelist)

/getbanlist, /getbaninfo, /unban
	-> bannedAccountsServers.json

/ban
	-> bannedAccountsServers.json (write path)

/farm enable, /farm disable, /farm prefix
	-> farmServerConfig.json

Farm text commands
	-> farmData.json
	-> crops.js
	-> priceHistory.json
```

## 9. Important Default Values

- `BOT_INSTANCE`: `1`
- Farm prefix: `h`

- Farm enabled: `true` if no explicit guild config exists
- New user farm state:
	- `money = 5000`
	- `experience = 0`
	- `landSlots = 10`

- Spam window fallback in code: `60000 ms`
- Spam threshold fallback in code: `3`

Operational note:

- Values created interactively in `loadBotConfig()` may differ from example prompt comments, so the active config file should be treated as the runtime source of truth.


# Auto-Ban Config Reference

## 1. Overview

The bot currently relies on two major groups of configuration and persisted data:

- Startup and moderation configuration.
- Data and configuration for the farming mini-game.

Some files are per-instance, while others are shared across all bot processes in the same repository.

## 2. Environment Variables

### `BOT_INSTANCE`

`utils/runtimeInstance.js` validates the `BOT_INSTANCE` environment variable and `configManager.js` uses it to determine which bot config file should be loaded:

- `BOT_INSTANCE=1` -> `configs/botConfig.1.json`
- `BOT_INSTANCE=2` -> `configs/botConfig.2.json`
- If unset -> defaults to `1`

This allows multiple Discord bot instances to run with different credentials while still sharing the same moderation and farm logic.

### `BOT_INSTANCES`

Startup scripts read `BOT_INSTANCES` to decide which PM2 apps to create:

- `BOT_INSTANCES=1,2,3` -> starts `autoban-1`, `autoban-2`, and `autoban-3`
- `BOT_INSTANCES="1 3"` -> starts `autoban-1` and `autoban-3`
- If unset -> scripts auto-detect `configs/botConfig.<n>.json`

When no matching config file exists, the scripts fail before starting PM2 so the bot does not hang on an interactive prompt inside tmux or Docker.

### `AUTO_BAN_BACKUP_OWNER`

Startup scripts set this to the first resolved instance so only one PM2 process creates startup and weekly backups:

- `AUTO_BAN_BACKUP_OWNER=1` and `BOT_INSTANCE=1` -> backups enabled
- `AUTO_BAN_BACKUP_OWNER=1` and `BOT_INSTANCE=2` -> backups skipped
- If unset -> the current process keeps the legacy behavior and creates backups

### `AUTO_BAN_DATA_KEY`

Optional encryption key for runtime JSON storage.

- If set, `safeJsonStore` derives the AES-256-GCM key from this value.
- A 32-byte base64 key or 64-character hex key is used directly.
- Any other non-empty value is hashed with SHA-256 to derive the 32-byte key.
- If unset, the bot generates a local key at `_backup/_keys/data-encryption-key`.

The key must be backed up securely. Encrypted config files and encrypted backups cannot be read without the same key.

### `AUTO_BAN_FSYNC_DIR`

Optional durability switch for local Linux filesystems:

- Unset/default: config writes fsync the temp file, then atomically rename it. Directory fsync is skipped for better compatibility with mounted filesystems.
- `AUTO_BAN_FSYNC_DIR=1`: also fsync the parent directory after rename, which can improve crash durability on native filesystems.

Do not enable this on filesystems where directory fsync may hang or fail, such as some mounted/mobile/remote filesystem bridges.

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
	"channelSpamThreshold": 4,
	"banMessageContentPolicy": "snippet",
	"banMessageContentMaxLength": 512,
	"banEvidenceRetentionDays": 90,
	"reuploadModerationAttachments": false
}
```

Field descriptions:

- `token`: Discord login token.
- `botId`: used for slash-command registration and lockfile naming.
- `deleteMessage`: whether the bot should delete a user's messages after banning them.
- `timeDeleteMessage`: retrospective deletion window in milliseconds.
- `spamWindowMs`: time window for multi-channel spam detection.
- `channelSpamThreshold`: number of distinct channels required to classify a message pattern as spam.
- `banMessageContentPolicy`: moderation evidence policy for ban records and ban embeds. Supported values: `none`, `snippet`, `full`; default is `snippet`.
- `banMessageContentMaxLength`: maximum stored/displayed snippet length when policy is `snippet`; default is `512`, capped at Discord's embed field limit.
- `banEvidenceRetentionDays`: days before snippets, fingerprints, and message/channel IDs are removed; default `90`, capped at `365`.
- `reuploadModerationAttachments`: whether the bot downloads and reposts attachments from triggering messages into DM/notify channels; default is `false`.

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
		"whitelist": ["333", "444"],
		"raidProtection": {
			"enabled": true,
			"mode": "quarantine",
			"joinThreshold": 10,
			"joinWindowMs": 60000,
			"campaignMinAccounts": 3,
			"campaignMinChannels": 3,
			"campaignWindowMs": 60000,
			"newAccountAgeMs": 604800000,
			"quarantineRoleId": "555",
			"protectedRoleId": null,
			"notifyChannelId": "1234567890",
			"releaseAfterScreening": false,
			"incidentRetentionDays": 30
		}
	}
}
```

Notes:

- `admins` is not set by `/setup`; it is managed later through `/addadmin` and `/deleteadmin`.
- `whitelist` is managed through `/addwhitelist` and `/deletewhitelist` and stores Discord user IDs.
- If `notifyChannelId` is not provided during `/setup`, the bot assigns `bannedChannelId` as the notify channel.
- This file is shared across all instances.

### `configs/raidIncidents.json`

Stores encrypted, expiring raid summaries: incident/guild IDs, timestamps, affected user IDs, aggregate join/new-account/campaign counts, action counts, status, and `expiresAt`. It does not store raw message content, a full member list, individual account ages, or live fingerprints. The file is recovered and backed up through `safeJsonStore`, pruned on startup and every 12 hours, and cleaned per user by `/deletebandata`.

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

- Stores per-user farm enable/disable state for each guild. Older config files may still contain a legacy `prefix` value, but farm gameplay is now slash-only.

Actual schema:

```json
{
	"<guildId>": {
		"enabled": {
			"<userId>": true
		}
	}
}
```

Notes:

- If a guild does not yet have config, `farmManager.isFarmingEnabled()` defaults to `true`.
- Existing files may still contain a legacy `prefix` field; the current bot ignores it.
- This file is managed through `safeJsonStore`, so writes are encrypted at rest, lock-protected, and atomic.

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

## 7. File Writes, Recovery, And Backups

Runtime JSON files are managed through `utils/safeJsonStore.js`.

Protected files:

- `botConfig.<instance>.json`
- `serverConfig.json`
- `bannedAccountsServers.json`
- `raidIncidents.json`
- `farmServerConfig.json`
- `farmData.json`
- `priceHistory.json`

Write pattern:

1. Acquire a per-file lock in `_backup/_locks/`.
2. Encrypt the JSON value using AES-256-GCM.
3. Write the encrypted payload to a randomly named `*.tmp` file in the same directory.
4. Flush the temp file to disk.
5. Use `renameSync()` to replace the original file atomically.
6. Optionally fsync the parent directory when `AUTO_BAN_FSYNC_DIR=1`.
7. Save an encrypted last-known-good copy in `_backup/_last-good/`.

Encryption key rules:

- Prefer setting `AUTO_BAN_DATA_KEY` in the process environment.
- If the environment key is missing, a local key is generated in `_backup/_keys/data-encryption-key`.
- Plaintext legacy JSON files are migrated to encrypted storage the first time they are read through `safeJsonStore`.

Recovery pattern:

1. If a runtime JSON file is missing, empty, or invalid, the bot attempts recovery before normal startup.
2. Invalid files are moved to `_backup/_corrupt/`.
3. Recovery first tries `_backup/_last-good/`.
4. If no last-good copy is available, recovery tries the newest zip backup in `_backup/`.
5. Data files that can be recreated fall back to `{}`. Bot config files do not get a default token-bearing value.

Backup pattern:

- On startup, after bot config is loaded, the backup owner writes `_backup/yyyy-mm-dd_hh-mm-ss.zip`.
- A scheduled backup is also created every 7 days while the backup-owner process stays online.
- The zip contains the full `configs/` directory, including JSON and JS config files.
- `_backup/` must stay ignored by Git because it can contain `botConfig.<instance>.json` tokens.

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

/deletebandata
	-> bannedAccountsServers.json
	-> raidIncidents.json (remove selected user references)
	-> serverConfig.json (fields whitelist, admins, adminIds)
	-> farmData.json
	-> farmServerConfig.json (field enabled)

/farm enable, /farm disable
	-> farmServerConfig.json

Farm slash gameplay commands
	-> farmData.json
	-> crops.js
	-> priceHistory.json

/raid setup, /raid disable
	-> serverConfig.json (field raidProtection)

/raid incidents
	-> raidIncidents.json
```

## 9. Important Default Values

- `BOT_INSTANCE`: `1`
- `BOT_INSTANCES`: auto-detect `configs/botConfig.<n>.json` in helper scripts
- `AUTO_BAN_BACKUP_OWNER`: unset outside helper scripts
- Legacy farm prefix value: ignored when present; prefix commands are not registered.

- Farm enabled: `true` if no explicit guild config exists
- New user farm state:
	- `money = 5000`
	- `experience = 0`
	- `landSlots = 10`

- Spam window fallback in code: `60000 ms`
- Spam threshold fallback in code: `3`
- Ban message content policy fallback: `snippet`
- Attachment re-upload fallback: `false`

Operational note:

- Values created interactively in `loadBotConfig()` may differ from example prompt comments, so the active config file should be treated as the runtime source of truth.


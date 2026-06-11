# Privacy Policy for Auto-Ban

Last updated: 2026-06-12

This Privacy Policy explains how **Auto-Ban** collects, uses, stores, protects, and deletes data for Discord users and servers.

## 1. Data We Collect

Auto-Ban may collect and store the following data when required for moderation, configuration, or bot features:

- Discord user IDs
- Discord usernames, tags, global names, or server display names when included in moderation records
- Discord guild IDs and channel IDs used for server configuration
- Server-specific bot settings, such as auto-ban channels and notification channels
- Admin contact and whitelist user IDs configured by server administrators
- Ban records created by the bot, including user ID, display name, timestamp, ban reason, and the last message content that triggered the moderation action
- Farming mini-game data, such as user ID, balance, experience, inventory, current crop, planted timestamp, and last login timestamp
- Farming enable/disable settings and server prefix settings

Auto-Ban may also temporarily process recent guild message content in memory to detect repeated multi-channel spam. This temporary spam-detection history is not used for advertising, profiling, or analytics.

Auto-Ban does **not** collect:

- Email addresses
- Passwords
- Payment information
- Direct message content for moderation
- Presence data

## 2. How We Use Data

Auto-Ban uses collected data only to provide bot functionality:

- Detect repeated spam across multiple guild channels
- Automatically ban users who trigger configured auto-ban rules
- Notify users and moderators about moderation actions
- Maintain moderation history for review commands such as `/getbanlist`, `/getbaninfo`, and `/unban`
- Manage whitelist and admin contact lists
- Run the optional farming mini-game
- Support user data deletion through `/deletebandata`

Message content is used only for deterministic moderation checks, prefix command parsing, moderation notifications, and limited ban records. It is not used to train machine learning or AI models.

## 3. Data Storage and Encryption

Runtime JSON configuration and data files are stored on the bot host and are encrypted at rest using AES-256-GCM through Auto-Ban's safe JSON storage layer.

The encryption key is loaded from the `AUTO_BAN_DATA_KEY` environment variable when provided. If no environment key is configured, Auto-Ban generates a local data encryption key under `_backup/_keys/`. Bot operators should back up this key securely and restrict filesystem access to the bot host.

Encrypted storage applies to runtime JSON files such as:

- `serverConfig.json`
- `bannedAccountsServers.json`
- `farmData.json`
- `farmServerConfig.json`
- `priceHistory.json`
- `botConfig.<instance>.json`

Auto-Ban also writes encrypted last-good recovery copies and encrypted config backups for these runtime JSON files.

## 4. Data Sharing

Auto-Ban does not sell, rent, or share stored user data with third parties.

Data is sent to Discord only as needed for bot functionality, such as sending moderation notifications, direct messages, command replies, and role updates through the Discord API.

## 5. Data Retention

Recent message content used for spam detection is kept in process memory only for the configured spam window.

Ban records, whitelist/admin entries, and farming data are retained until they are no longer needed for bot functionality, are removed by a server administrator, or are deleted after a valid deletion request.

## 6. Data Deletion

Server administrators can delete stored Auto-Ban data for a user by running:

```text
/deletebandata <user>
```

This command deletes the selected user's stored data from:

- `bannedAccountsServers.json`
- `farmData.json`
- `farmServerConfig.json` farming enable/disable entries
- `serverConfig.json` whitelist and admin contact lists

Users and server administrators may also request data deletion by contacting the bot owner:

- GitHub: https://github.com/Elaina69/Auto-Ban
- Discord: Elaina

Deletion requests will be handled within a reasonable timeframe after the request is verified.

## 7. Children's Privacy

Auto-Ban does not knowingly collect data from users under the age of 13 and is intended to be used in accordance with Discord's Terms of Service and Community Guidelines.

## 8. Changes to This Policy

This Privacy Policy may be updated when Auto-Ban changes how it collects, uses, stores, or deletes data.

## 9. Contact

For questions about this Privacy Policy or data deletion:

- GitHub: https://github.com/Elaina69/Auto-Ban
- Discord: Elaina

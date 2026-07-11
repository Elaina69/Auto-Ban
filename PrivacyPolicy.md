# Privacy Policy for Auto-Ban

Last updated: 2026-07-12

This Privacy Policy explains how **Auto-Ban** collects, uses, stores, protects, and deletes data for Discord users and servers.

## 1. Data We Collect

Auto-Ban may collect and store the following data when required for moderation, configuration, or bot features:

- Discord user IDs
- Discord usernames, tags, global names, or server display names when included in moderation records
- Discord guild IDs and channel IDs used for server configuration
- Server-specific bot settings, such as auto-ban channels and notification channels
- Admin contact and whitelist user IDs configured by server administrators
- Ban records created by the bot, including user ID, display name, timestamp, ban reason, and limited message evidence according to the configured moderation evidence policy
- Raid incident summaries, including guild ID, incident ID, timestamps, affected user IDs, aggregate join/campaign counts, and moderation action counts
- Raid protection settings, such as join/campaign thresholds, notification channel, quarantine role, protected role, action mode, and retention period
- Farming mini-game data, such as user ID, balance, experience, inventory, current crop, planted timestamp, and last login timestamp
- Farming enable/disable settings and gameplay data

Auto-Ban temporarily processes guild message content to create keyed HMAC fingerprints for repeated cross-channel and coordinated raid-campaign detection. Recent-message history stores the fingerprint, guild/user/channel IDs, and timestamp in process memory rather than raw message text. Message content is not used for farming gameplay, advertising, profiling, analytics, or machine learning.

Guild member join, update, and leave events are processed for opt-in join-raid protection. The bot does not persist a complete guild member list. Active raid cohorts are held temporarily in memory; retained incident summaries contain only affected user IDs and aggregate moderation information.

Attachment re-upload for moderation notifications is disabled by default and only runs if the bot operator explicitly enables it in the bot configuration.

Auto-Ban does **not** collect:

- Email addresses
- Passwords
- Payment information
- Direct message content for moderation
- Presence data
- A persistent copy of the full guild member list

## 2. How We Use Data

Auto-Ban uses collected data only to provide bot functionality:

- Detect repeated spam across multiple guild channels
- Detect join bursts and coordinated message campaigns involving newly joined member cohorts
- Apply and remove configured quarantine roles, protect sensitive roles during active incidents, and clean up transient cohort state when members leave
- Automatically ban users who trigger configured auto-ban rules
- Notify users and moderators about moderation actions
- Maintain moderation history for review commands such as `/getbanlist`, `/getbaninfo`, and `/unban`
- Manage whitelist and admin contact lists
- Run the optional farming mini-game
- Support user data deletion through `/deletebandata`

Message content is used only for deterministic moderation checks, moderation notifications, and limited ban records when a moderation rule is triggered.

## 3. Data Storage and Encryption

Runtime JSON configuration and data files are stored on the bot host and are encrypted at rest using AES-256-GCM through Auto-Ban's safe JSON storage layer.

The encryption key is loaded from the `AUTO_BAN_DATA_KEY` environment variable when provided. If no environment key is configured, Auto-Ban generates a local data encryption key under `_backup/_keys/`. Bot operators should back up this key securely and restrict filesystem access to the bot host.

Encrypted storage applies to runtime JSON files such as:

- `serverConfig.json`
- `bannedAccountsServers.json`
- `raidIncidents.json`
- `farmData.json`
- `farmServerConfig.json`
- `priceHistory.json`
- `botConfig.<instance>.json`

Auto-Ban also writes encrypted last-good recovery copies and encrypted config backups for these runtime JSON files.

## 4. Data Sharing

Auto-Ban does not sell, rent, or share stored user data with third parties.

Data is sent to Discord only as needed for bot functionality, such as sending moderation notifications, direct messages, command replies, and role updates through the Discord API.

## 5. Data Retention

Raw message content is not stored in recent-message history. HMAC fingerprints and routing identifiers are removed after the configured spam or campaign window. Active member cohorts expire when their incident closes or times out.

Ban records store only the moderation evidence allowed by the bot configuration, which defaults to a short snippet. Message evidence, fingerprints, and message/channel IDs expire after `banEvidenceRetentionDays`; the minimal user ID, ban time, reason, and display label may remain so ban review and unban commands continue to work. Raid incident summaries expire after the server-configured period, from 1 to 90 days. Whitelist/admin entries and farming data remain until removed or deleted after a valid request.

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
- User references inside `raidIncidents.json`

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

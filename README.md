<h1 align="center">
    Auto Ban
</h1>

<p align="center">
    <img src="https://count.getloli.com/@Auto-Ban?name=Auto-Ban&theme=gelbooru&padding=7&offset=0&align=center&scale=1&pixelated=1&darkmode=auto" alt="moe counter" />
    <p align="center"> Visitors (Since 2025/08/06) </p>
    <br>
    <p align="center"> Lightweight bot for Discord, auto ban users whenever they send message in specific channel </p>
</p>

## How to setup bot
 - Invite bot: [Invite](https://discord.com/oauth2/authorize?client_id=1402250342040731688)
 - Bot must have `Ban Members`, `Kick Members`, `Manage channels`, `Manage Messages`, `Read Message History`, `Send Messages`, `View Channels` permission in all text channels to run.

## Commands
 - `/setup (channel to ban) (ban notify channel)`: Setup the bot.
 - `/checkperm (channel - not required)`: Check if the bot has the required permissions in that channel.
 - `/banlist`: Returns a list of accounts banned by the bot.
 - `/addadmin (user)`: Adds an admin/mod to the "contact" section of the ban message.
 - `/deleteadmin (user)`: Removes an admin/moderator from the list.
 - `/adminlist`: Returns a list of admins/moderators for the "contact" section of the ban message.

## How to self-host
 - Clone this repo

 - Install latest version of NodeJS (if can)

 - Open terminal(cmd) on this repo, install discord.js

```bash
npm install discord.js
```

 - Run `node index.js` to start bot

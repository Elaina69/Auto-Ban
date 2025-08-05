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
 - Bot must have `Ban Members`, `Kick Members`, `Manage channels`, `Manage Messages`, `Read Message History`, `Send Messages`, `View Channels` permission in text channel to run.

 - Use `/setup (channel to ban) (notify channel)` to setup the bot.

## How to host
 - Clone this repo
  
 - Create new file `/configs/botConfig.js`

```javascript
export default {
    // Bot token
    token: string,
    // Bot id (Application Id)
    botId: "1402250342040731688",

    deleteMessage: true,

    timeDeleteMessage: 3600000,
}
```
 - Run `node index.js` to start bot

<h1 align="center">
    Auto Ban
</h1>

<p align="center">
    <img src="https://count.getloli.com/@Auto-Ban?name=Auto-Ban&theme=gelbooru&padding=7&offset=0&align=center&scale=1&pixelated=1&darkmode=auto" alt="moe counter" />
    <p align="center"> Visitors (Since 2025/08/06) </p>
    <br>
    <p align="center"> Discord moderation bot for cross-channel spam, coordinated message campaigns, and real-time join-raid protection. </p>
</p>

## Overview

This project supports these self-hosting workflows:

- **Host mode**: run one or more bot instances directly on the machine with Node.js + PM2.
- **Linux helper script mode**: use the included `tmux` scripts to run host mode on a Linux server.
- **Docker mode**: run one Ubuntu/Node container, then start multiple PM2 apps inside the container through `docker exec`.

Auto-Ban can run multiple Discord bot instances from the same repository. Each instance uses its own bot token/config file:

- `BOT_INSTANCE=1` -> `configs/botConfig.1.json`
- `BOT_INSTANCE=2` -> `configs/botConfig.2.json`

Shared runtime data stays in the project folder:

- `configs/serverConfig.json`: per-guild moderation setup.
- `configs/bannedAccountsServers.json`: ban history.
- `configs/raidIncidents.json`: encrypted, time-limited raid incident summaries.
- `configs/farmData.json`, `configs/farmServerConfig.json`, `configs/priceHistory.json`: farm mini-game data.
- `_backup/`: encrypted backups, last-known-good copies, recovery data, and local encryption keys.
- `logs/instance-<n>/`: per-instance daily logs.
- `*.lock`: runtime lock files used to prevent duplicate bot processes with the same `botId`.

Do not commit or share `configs/botConfig.<instance>.json` or `_backup/`.

## Requirements

Common:

- Git
- Node.js 18+
- npm

Host mode:

- PM2 installed globally

Linux helper scripts:

- `tmux`

Docker mode on Linux:

- Docker
- sudo/root permission for Docker commands

### Install Requirements

Ubuntu/Debian host mode:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates tmux
curl -fsSL https://deb.nodesource.com/setup_26.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

Windows host mode, PowerShell:

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
npm install -g pm2
```

Docker mode on Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates tmux docker.io
sudo systemctl enable --now docker
sudo docker --version
```

## Discord Bot Setup

Create one Discord application and bot per instance, then prepare:

- Bot token
- Application/client ID, used as `botId`

The bot needs these permissions in the relevant text channels:

- `Ban Members`
- `Kick Members`
- `Manage Channels`
- `Manage Messages`
- `Manage Roles` when quarantine or protected-role handling is enabled
- `Read Message History`
- `Send Messages`
- `View Channels`

Privileged intent scope:

- `Message Content Intent` is used only for automatic moderation: HMAC fingerprint correlation across channels/accounts and limited evidence for triggered bans.
- Farm gameplay uses slash commands only and does not read message content.
- `Server Members Intent` is required for real-time join, update, and leave events used by join-burst detection, quarantine, membership-screening release, protected-role enforcement, and raid-cohort cleanup.
- The bot does not persist a complete guild member list. Active cohorts and message fingerprints are process-memory state with bounded lifetimes.

The bot registers these global slash commands:

- `/help`
- `/setup`
- `/checkperm`
- `/getbanlist`
- `/addadmin`, `/deleteadmin`, `/getadminlist`
- `/addwhitelist`, `/deletewhitelist`, `/getwhitelist`
- `/ban`, `/unban`
- `/getbaninfo`
- `/deletebandata`
- `/raid setup`, `/raid disable`, `/raid status`, `/raid incidents`, `/raid test`
- `/privacy`
- `/farm enable`, `/farm disable`, `/farm help`, `/farm login`, `/farm status`
- `/farm grow`, `/farm harvest`, `/farm sell`, `/farm buy`, `/farm expand`
- `/farm crops`, `/farm info`, `/farm role-list`, `/farm role-buy`

## First-Time Config

Clone the project:

```bash
git clone <repo-url>
cd Auto-Ban
```

Create one config file per bot instance before starting through PM2, tmux, Docker, or systemd. This avoids hidden interactive prompts.

Linux/macOS:

```bash
mkdir -p configs
nano configs/botConfig.1.json
nano configs/botConfig.2.json
```

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force configs
notepad .\configs\botConfig.1.json
notepad .\configs\botConfig.2.json
```

Use this shape for each instance:

```json
{
    "token": "YOUR_DISCORD_BOT_TOKEN",
    "botId": "YOUR_DISCORD_APPLICATION_ID",
    "deleteMessage": true,
    "timeDeleteMessage": 86400000,
    "spamWindowMs": 60000,
    "channelSpamThreshold": 3,
    "banMessageContentPolicy": "snippet",
    "banMessageContentMaxLength": 512,
    "banEvidenceRetentionDays": 90,
    "reuploadModerationAttachments": false
}
```

## Raid Protection

Raid protection is opt-in per server. Configure it with `/raid setup` and choose one mode:

- `alert`: detect and notify without modifying members.
- `quarantine`: apply the configured quarantine role to an active join cohort.
- `enforce`: quarantine the cohort and ban only the account whose message completes a coordinated campaign threshold.

An enforcement decision requires both an active join-burst incident and the same normalized payload reaching the configured account/channel thresholds. Account age or join speed alone never causes a ban. `/raid test` only validates alert delivery and never modifies members or stores an incident.

Recent message history contains HMAC-SHA-256 fingerprints rather than raw text and is partitioned by guild and user. Raid incident summaries are AES-256-GCM encrypted and automatically expire according to the guild retention setting.

The deployment, evidence-recording, and intent-submission checklist is in [`_docs/intent-review.md`](_docs/intent-review.md).

If you run `node index.js` directly and the selected config is missing, the bot can create it interactively. For PM2/Docker/tmux, create the file first.

## Instance Selection

The helper scripts decide which bot instances to start in this order:

1. If `BOT_INSTANCES` is set, run only that list.
2. Otherwise, auto-detect `configs/botConfig.<n>.json`.
3. If no config files exist, default to instance `1` and fail early unless `configs/botConfig.1.json` exists.

Examples:

```bash
# Run all detected configs
./_run.sh

# Run only instance 2
BOT_INSTANCES=2 ./_run.sh

# Run instances 1 and 3
BOT_INSTANCES=1,3 ./_run.sh
```

PM2 app names are always `autoban-<instance>`, for example `autoban-1` and `autoban-2`.

## Host Mode

Use this mode when Node.js and PM2 are installed directly on the machine.

### Linux With Included Scripts

```bash
chmod +x _*.sh
./_run.sh
```

What happens:

1. `_run.sh` resolves the instance list from `BOT_INSTANCES` or `configs/botConfig.<n>.json`.
2. `_create-tmux-session.sh` creates tmux session `autoban`.
3. Inside tmux, `_create-pm2-session.sh` installs dependencies with `npm ci` if needed.
4. `_create-pm2-session.sh` starts one PM2 app per instance with `BOT_INSTANCE=<n>`.
5. The first resolved instance becomes `AUTO_BAN_BACKUP_OWNER`, so only one process creates startup and weekly backups.
6. tmux opens `pm2 monit`.

Attach to the session:

```bash
tmux attach -t autoban
```

Detach from tmux without stopping the bots:

```text
Ctrl+B, then D
```

### Windows With PM2

The included `_run.sh` script depends on Bash and `tmux`, so it is intended for Linux servers. On Windows, run each instance directly with PM2:

```powershell
npm ci
$env:AUTO_BAN_BACKUP_OWNER="1"
$env:BOT_INSTANCE="1"; pm2 start index.js --name autoban-1
$env:BOT_INSTANCE="2"; pm2 start index.js --name autoban-2
pm2 monit
```

Common Windows PM2 commands:

```powershell
pm2 status
pm2 logs autoban-1
pm2 restart autoban-1
pm2 stop autoban-1
```

## Docker Mode

Use this mode when you want the bots isolated in one Docker container on Linux. Docker mode may work on Windows with Docker Desktop or WSL2, but it is not documented or verified yet.

```bash
chmod +x _*.sh
./_run\(docker\).sh
```

What happens:

1. `_run(docker).sh` re-runs itself with `sudo -E` if needed.
2. `_create-docker-image.sh` creates image `autoban` if it does not exist.
3. `_create-docker-container.sh` creates container `autoban-container` if it does not exist.
4. The container starts with `--restart unless-stopped` and stays idle with `tail -f /dev/null`.
5. A root tmux session opens `docker exec -it autoban-container bash`.
6. Inside the container, `_create-pm2-session.sh` starts one PM2 app per resolved instance.
7. tmux opens `pm2 monit`.

Attach to the Docker tmux session:

```bash
sudo tmux attach -t autoban
```

Run a subset of instances:

```bash
BOT_INSTANCES=1,3 ./_run\(docker\).sh
```

Important Docker note:

The container is configured to restart automatically, but the bot processes are created through `docker exec`. If the container is restarted, run this again to recreate the PM2 apps inside the container:

```bash
./_run\(docker\).sh
```

Rebuild the Docker image after Dockerfile changes:

```bash
sudo docker rm -f autoban-container
sudo docker build --no-cache -t autoban .
./_run\(docker\).sh
```

## Optional Linux Systemd

You can let a Linux server run either mode on boot. Windows does not use systemd; use PM2 directly, Windows Task Scheduler, or another Windows service manager if you need automatic startup there.

First, make the scripts executable:

```bash
cd /path/to/Auto-Ban
chmod +x _*.sh
```

Then create a systemd service file:

```bash
sudo nano /etc/systemd/system/autoban.service
```

Use one of the following service definitions.

Host mode service:

```ini
[Unit]
Description=Auto-Ban
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=YOUR_LINUX_USER
WorkingDirectory=/path/to/Auto-Ban
Environment=BOT_INSTANCES=1,2
ExecStart=/path/to/Auto-Ban/_run.sh

[Install]
WantedBy=multi-user.target
```

Docker mode service:

```ini
[Unit]
Description=Auto-Ban Docker
Wants=network-online.target
Requires=docker.service
After=network-online.target docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/path/to/Auto-Ban
Environment=BOT_INSTANCES=1,2
ExecStart=/path/to/Auto-Ban/_run(docker).sh
ExecStop=-/usr/bin/docker stop autoban-container

[Install]
WantedBy=multi-user.target
```

Reload systemd, enable the service at boot, and start it now:

```bash
sudo systemctl daemon-reload
sudo systemctl enable autoban.service
sudo systemctl start autoban.service
sudo systemctl status autoban.service
```

View service logs:

```bash
sudo journalctl -u autoban.service -f
```

## Operations

Show PM2 status in host mode:

```bash
pm2 status
pm2 logs autoban-1
pm2 logs autoban-2
```

Show Docker container status:

```bash
sudo docker ps
sudo docker exec autoban-container pm2 status
```

Stop host mode:

```bash
tmux kill-session -t autoban
pm2 stop autoban-1 autoban-2
```

Stop Docker mode:

```bash
sudo tmux kill-session -t autoban
sudo docker stop autoban-container
```

Remove Docker container:

```bash
sudo docker rm -f autoban-container
```

## Troubleshooting

`Missing required config: configs/botConfig.<instance>.json`

The helper scripts never start PM2/Docker without a config file. Create the missing file or set `BOT_INSTANCES` to a list that matches existing config files.

`Bot with botId ... is already running`

A lock file detected another running bot process using the same Discord application ID. Stop the old PM2 process/session first. If the process is already gone, the bot will remove stale lock files automatically on next start.

`Docker container keeps restarting with exit code 127`

The image likely does not contain PM2 or Node correctly. Rebuild:

```bash
sudo docker rm -f autoban-container
sudo docker build --no-cache -t autoban .
./_run\(docker\).sh
```

Slash commands do not appear immediately

The bot registers global slash commands on startup. Global command propagation can take a little time.

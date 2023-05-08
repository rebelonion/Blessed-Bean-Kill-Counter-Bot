# Blessed Bean Kill Counter Bot

This Discord bot is designed to take 1 to 3 character names from EVE Online and return their combined kill count for the past 30 days. It automatically excludes duplicate kills and provides reasons for any kills that are not counted.

## Quick Start

To add the bot to your server, visit [this link](https://discord.com/oauth2/authorize?client_id=1103777897958879332&permissions=2048&scope=applications.commands%20bot).

If you would like to run your own instance of the bot, follow the guide below.

## Usage

The bot has two commands:

`/kills`: Use this command with up to 3 arguments to learn the combined number of kills. The bot will automatically exclude duplicates.

`/why`: Use this command with up to 3 arguments to learn the reasons for some kills not being counted.

## Not Counted Kills

The bot currently excludes kills for 3 reasons:

1. Victim is friendly.
2. Victim is a blacklisted type (fighters, deployables, etc.).
3. Another one of your provided players is already on this kill.

## How It Works

The bot takes any given player names and finds their character IDs through CCP's provided ESI. It then pulls the most recent 200 killmails from zkillboard.com's API. For each killmail, the bot pulls all the information from CCP's ESI with the killmail ID and hash provided by zkillboard. Finally, the bot compares its list of killmails to the blacklist and the blues list to remove any that are not counted. The result is then sent to the user.

## Blacklist

The provided blacklist removes kills for pods, fighters, mobile depots/other anchorables.

## Self-Host

If you want to host the bot yourself, you'll need to:

1. Install Node.js and npm.
2. Install the following dependencies: Discord.js, dotenv, and @adobe/node-fetch-retry.
3. If you are on Windows, you can get up and running quickly with Nodemon. On Linux, we recommend using PM2.
4. Follow these guides or similar for setting up Discord bots: [installing discord.js](https://discordjs.guide/preparations/#installing-node-js), [running on Linux](https://www.vultr.com/docs/run-a-discord-js-bot-on-ubuntu-20-04/), and [running on Windows](https://www.writebots.com/how-to-make-a-discord-bot/).

You will also need your friendly list named `blues.json` and create a `.env` file.

## Friendly List

This is a `.json` file that you must provide. The easiest way to obtain a list of blue pilots is to go to https://esi.evetech.net/ui/#/Contacts/get_alliances_alliance_id_contacts, login with the correct scopes, and hit "Try it out" to download a list of your alliance's current blues.

## .env

The `.env` file needs 4 variables:

- `TOKEN`: Discord bot token
- `CLIENT_ID`: Bot client ID
- `GUILD_ID`: Server ID (not necessary for global slash commands)
- `MAINTAINER`: A way for the owners of the APIs to contact you if there is a problem.
temporary readme, contact ifritdiezel#5635 on discord for info for now

the bot requires presence privileges and role management

emoji are hardcoded so they'll be broken sorry

1. clone the repo, edit config.json: **token** your bot token, **clientId** is the bot's id, **guildId** for the guild you want to add the commands to, **noPingRoleId** is any role the bot can assign, **jarName** is the name of the executable (has to be is-seedfinder)
2. run `npm update` to get the required packages
3. run `node deploy-commands.js` to enable the commands
4. run `node index.js` to start the bot

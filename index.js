const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const config = require('./config.json');
const { handleMessage } = require('./handleTextMessage.js')

if (!fs.existsSync('scanresults')) {
	console.log("\x1b[31m■\x1b[0m You should run 'node deploy-commands.js' to enable the commands first.");
}

if (!config.jarName) {
	console.log("\x1b[31m■\x1b[0m Please specify the name of the seedfinder .jar in the config.");
	process.exit(1);
}

if (!config.token) {
	console.log("\x1b[31m■\x1b[0m Please provide a Discord bot token in the config.");
	process.exit(1);
}

if (!fs.existsSync(config.jarName)) {
  console.log("\x1b[31m■\x1b[0m No valid seedfinder .jar named '" + config.jarName + "' found! Please download the most recent one at");
	console.log("\x1b[31m■\x1b[0m https://github.com/ifritdiezel/is-seedfinder/releases");
	console.log("\x1b[31m■\x1b[0m then place in the bot directory and specify its name in the config!");
	process.exit(1);
}

if (config.versionName.startsWith("2.0") || config.versionName.startsWith("1.4")) {
	console.log("\x1b[31m■\x1b[0m This bot version is incompatible with this seedfinder version due to argument changes.");
}

if (config.scanresultServer){
	require('/home/user/Desktop/server/seedfinderhttp/index.js')
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, () => {
	console.log('Ready!');
});


client.on(Events.MessageCreate, message => {
	if (!config.enableTextCommands) return;
	if (message.author.bot) return;
	if (!message.guild.members.me.permissionsIn(message.channel).has(new PermissionsBitField([PermissionsBitField.Flags.SendMessages]))) return;
	handleMessage(message);
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) return;

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});


client.login(config.token);

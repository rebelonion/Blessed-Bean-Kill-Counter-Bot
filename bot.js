

// Require necessary files
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits} = require('discord.js');
require('dotenv').config();
const token = process.env['TOKEN'];


// New client instance with specified intents
const client = new Client({
    intents: [
      GatewayIntentBits.Guilds
    ],
  })

// Read commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	client.commands.set(command.data.name, command);
}

// Notify that the bot is online
client.once('ready', () => {
	console.log(`Ready! Logged in as ${client.user.tag}`);
});

// Dynamically execute commands
client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) return;

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

// Login to Discord
client.login(token);
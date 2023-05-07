// Run node deploy-commands.js to register guild commands
// In vscode, you can use the built-in terminal to run this command

// This registers guild commands.
// Use Routes.applicationCommands(clientId) to register global commands (NOTE: global commands take ONE HOUR to update)

// Require necessary files
const {
    REST,
    Routes
} = require('discord.js');
require('dotenv').config();
const token = process.env['TOKEN'];
const clientId = process.env['CLIENT_ID'];
const guildId = process.env['GUILD_ID'];
const fs = require('node:fs');
const path = require('node:path');

const commands = [];
// Grab all the command files from the commands directory you created earlier
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy your commands!
(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId), {
                body: commands
            },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        console.error(error);
    }
})();
const fs = require('fs');
require('dotenv').config();

const maintainer = process.env['MAINTAINER'];

// Read the contents of blues.json synchronously
const bluesJson = fs.readFileSync('blues.json');
// Parse the contents of blues.json into a JavaScript object
const blues = JSON.parse(bluesJson);

// Read the contents of blacklist.json synchronously
const blacklistJson = fs.readFileSync('blacklist.json');
// Parse the contents of blacklist.json into a JavaScript object
const blacklist = JSON.parse(blacklistJson);

const {
    SlashCommandBuilder
} = require('discord.js');
// Import fs module dynamically 
const fetch = (...args) => import('node-fetch').then(({
    default: fetch
}) => fetch(...args));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kills')
        .setDescription('Gets the number of kills in the last 30 days.')
        .addStringOption(option =>
            option.setName('player')
            .setDescription('The name of the player.')
            .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('player2')
            .setDescription('The name of another player.')
            .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('player3')
            .setDescription('The name of another player.')
            .setRequired(false)
        ),
    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true
        });

        console.log(`command called by ${interaction.user.tag} at ${interaction.user.createdAt} on ${interaction.guild.name} in ${interaction.channel.name}`)

        //if not created, create the file recentRequests.json
        if (!fs.existsSync('recentKillRequests.json')) {
            fs.writeFileSync('recentKillRequests.json', '{}');
        }
        //check if the user has made a request in the last 5 minutes
        const recentRequestsJson = fs.readFileSync('recentKillRequests.json');
        const recentRequests = JSON.parse(recentRequestsJson);
        if (recentRequests[interaction.user.id] != null) {
            const lastRequest = recentRequests[interaction.user.id];
            const timeSinceLastRequest = (Date.now() - lastRequest) / 1000;
            if (timeSinceLastRequest < 300) {
                console.log(`Time since last request: ${timeSinceLastRequest} seconds.`)
                const minutes = Math.floor((300 - timeSinceLastRequest) / 60);
                const seconds = Math.floor((300 - timeSinceLastRequest) % 60);
                console.log(`User ${interaction.user.tag} has made a request in the last 5 minutes. Please wait ${minutes} minutes and ${seconds} seconds before making another request.`);
                return interaction.editReply(`You have made a request in the last 5 minutes. Please wait ${minutes} minutes and ${seconds} seconds before making another request.`);
            }
        } else {
            //add the user to the recentRequests.json file
            recentRequests[interaction.user.id] = Date.now();
            fs.writeFileSync('recentKillRequests.json', JSON.stringify(recentRequests));
        }

        var numplayers = 1;
        //if player2 or player3 is not null, then numplayers = 2, if both are not null, then numplayers = 3
        //because of discord, player3 can be used even if player2 is null
        if (interaction.options.getString('player2') != null) {
            numplayers++;
        }
        if (interaction.options.getString('player3') != null) {
            numplayers++;
        }
        console.log(`numplayers is ${numplayers}`);

        const characterName = interaction.options.getString('player');

        const characterIDAPI = 'https://esi.evetech.net/latest/universe/ids/?datasource=tranquility&language=en';
        const characterAPIheaders = {
            "Accept": "application/json",
            "Accept-Language": "en",
            "Content-Type": "application/json",
            "Cache-Control": "no-cache"
        };

        const characterAPIbody = JSON.stringify([characterName]);
        fetch(characterIDAPI, {
                method: "POST",
                headers: characterAPIheaders,
                timeout: 10000,
                body: characterAPIbody,
            })
            .then(response => response.json())
            .then(async response => {


                // check if the character section exists
                if (!response.characters) {
                    await interaction.reply(`${characterName} is not a valid character.`);
                    return;
                }
                const characterId = response.characters[0].id;
                console.log(`The character ID for ${characterName} is ${characterId}.`);

                // Encode the character ID for use in the URL
                const encodedCharacterID = encodeURIComponent(characterId);

                // Construct the API URL
                const apiUrl = `https://zkillboard.com/api/kills/characterID/${encodedCharacterID}/`;

                // Set headers for the API request
                const headers = {
                    'Accept-Encoding': 'gzip',
                    'User-Agent': `discord bot. maintainer: ${maintainer}`
                };

                // Fetch the kill data from the API
                fetch(apiUrl, {
                        headers: headers,
                        timeout: 10000
                    })
                    .then(response => response.json())
                    .then(async response => {

                        // Check if there was a kill found
                        if (response.length === 0) {
                            await interaction.editReply(`${playerName} has no recent kills.`);
                            return;
                        }

                        // Extract the kill details
                        const kill = response[0];
                        const killId = kill.killmail_id;

                        // Create empty arrays to store the killmail IDs and hashes
                        const killmailIds = [];
                        const killmailHashes = [];

                        // Get all of the killmail hashes
                        for (let i = 0; i < response.length; i++) {
                            const killmailHash = response[i].zkb.hash;
                            killmailHashes.push(killmailHash);
                        }

                        // Get all of the killmail IDs
                        for (let i = 0; i < response.length; i++) {
                            const killmailId = response[i].killmail_id;
                            killmailIds.push(killmailId);
                        }

                        var numkills = await getNumberOfKills(killmailIds, killmailHashes);

                        //update the recentRequests.json file
                        recentRequests[interaction.user.id] = Date.now();
                        fs.writeFileSync('recentKillRequests.json', JSON.stringify(recentRequests));

                        // Send the kill details as a reply
                        //if the total kills is greater than or equal to 200, add  a + to the end
                        //the last 3 characters of numkills are usually the number of kills
                        if (numkills.slice(-3) >= 200) {
                            return interaction.editReply(`${characterName} has at least ${numkills}+ total kills.`);

                        } else {
                            return interaction.editReply(`${characterName} has ${numkills} total kills.`);
                        }
                    })
                    .catch(error => {
                        if (error.message === 'ReferenceError: response is not defined') {
                            console.error(`Error fetching kill data: ${error}`);
                            return interaction.editReply(`${characterName} has no (recent) kill history.`);
                        } else {
                            console.error(`Error fetching kill data: ${error}`);
                            return interaction.editReply(`Error fetching kill data: ${error}. Bot may be rate limited.\nPlease try again later.`);

                        }
                    });
            })
            .catch(error => {
                console.error(`Error fetching character ID: ${error}`);
                return interaction.editReply(`${characterName} was not found.`);
            });
    },
};

//return the number of kills in the last 30 days
function getNumberOfKills(killmailIds, killmailHashes) {
    const requestHeaders = {
        "Accept": "application/json",
        "cache-control": "no-cache"
    };

    // map the killmail ids and hashes to an array of promises
    const requests = killmailIds.map((id, index) => {
        const requestAPI = `https://esi.evetech.net/latest/killmails/${id}/${killmailHashes[index]}/?datasource=tranquility`;
        return fetch(requestAPI, {
                method: "GET",
                headers: requestHeaders,
                timeout: 10000
            })
            .then(response => response.json())
            .then(response => response)
            .catch(error => {
                console.error(`Error fetching killmail data: ${error}`);
                return interaction.editReply(`Error fetching killmail data: ${error}. Bot may be rate limited.\nPlease try again later.`);;
            });
    });
    // wait for all promises to resolve
    return Promise.all(requests).then(killmailData => {
        // find the amount of kills in the last 30 days (time format is YYYY-MM-DDTHH:MM:SSZ)
        const today = new Date();
        var numberOfKills = 0;
        var totalKills = 0;
        const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30));
        for (let i = 0; i < killmailData.length; i++) {
            const killDate = new Date(killmailData[i].killmail_time);
            if (killDate > thirtyDaysAgo) {
                // get the victim's alliance_id, character_id, and corporation_id
                const victimAllianceId = killmailData[i].victim.alliance_id;
                const victimCharacterId = killmailData[i].victim.character_id;
                const victimCorporationId = killmailData[i].victim.corporation_id;

                // check if the victim is in blues.json and if their standing is >= 0
                const isVictimFriendly = blues.some(contact => {
                    return (
                        (contact.contact_type === "character" && contact.contact_id === victimCharacterId && ((!contact.standing && contact.standing !== 0) || (contact.standing > 0))) ||
                        (contact.contact_type === "corporation" && contact.contact_id === victimCorporationId && ((!contact.standing && contact.standing !== 0) || (contact.standing > 0))) ||
                        (contact.contact_type === "alliance" && contact.contact_id === victimAllianceId && ((!contact.standing && contact.standing !== 0) || (contact.standing > 0)))
                    );
                });

                // check if the vicim ship_type_id is blacklisted
                const isVictimBlacklisted = blacklist.some(ship => {
                    return (
                        ship.id === killmailData[i].victim.ship_type_id
                    );
                });

                // if the victim is not friendly, increment the kill count
                if (!isVictimFriendly) {
                    if (!isVictimBlacklisted) {
                        numberOfKills++;
                    } else {
                        console.log(`Victim is blacklisted: ${killmailData[i].killmail_id}`);
                    }
                } else {
                    console.log(`Victim is friendly: ${killmailData[i].killmail_id}`);
                }
                totalKills++;
            }
        }
        //combine the number of kills and the total number of kills into a string
        numberOfKills = numberOfKills.toString() + " accepted out of " + totalKills.toString();


        // return the number of kills in the last 30 days
        console.log(`The number of kills in the last 30 days is ${numberOfKills}.`);
        console.log(`The total number of kills is ${totalKills}.`);
        console.log(''); // add a blank line to the console output
        return numberOfKills;
    });
}
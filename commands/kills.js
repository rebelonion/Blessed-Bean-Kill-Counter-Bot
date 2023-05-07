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
            option.setName('player1')
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

        console.log('');
        console.log('----------------------------------- NEW ENTRY -----------------------------------');
        console.log('Entry type: kills.js');
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
                console.log(''); //blank line
                return interaction.editReply(`You have made a request in the last 5 minutes. Please wait ${minutes} minutes and ${seconds} seconds before making another request.`);
            }
        } else {
            //add the user to the recentRequests.json file
            recentRequests[interaction.user.id] = Date.now();
            fs.writeFileSync('recentKillRequests.json', JSON.stringify(recentRequests));
        }

        var numCharacters = 1;
        //if player2 or player3 is not null, then numCharacters = 2, if both are not null, then numCharacters = 3
        //because of discord, player3 can be used even if player2 is null
        if (interaction.options.getString('player2') != null) {
            numCharacters++;
        }
        if (interaction.options.getString('player3') != null) {
            numCharacters++;
        }
        console.log(`numCharacters is ${numCharacters}`);

        //get the character names
        var characterNames = [];
        for (let i = 0; i < numCharacters; i++) {
            characterNames[i] = interaction.options.getString(`player${i+1}`);
            console.log(`characterNames[${i}] is ${characterNames[i]}`);
        }

        var errorFlag = false;

        const characterIDAPI = 'https://esi.evetech.net/latest/universe/ids/?datasource=tranquility&language=en';
        const characterAPIheaders = {
            "Accept": "application/json",
            "Accept-Language": "en",
            "Content-Type": "application/json",
            "Cache-Control": "no-cache"
        };

        // empty arrays to store the killmail IDs and hashes
        const killmailIds = [];
        const killmailHashes = [];
        // empty array to store the fetch promises
        const fetchPromises = [];

        for (let i = 0; i < numCharacters; i++) {
            //check for errors
            if (errorFlag) {
                return;
            }
            const characterName = characterNames[i];
            console.log(`characterName is ${characterName}`);
            const characterAPIbody = JSON.stringify([characterName]);
            var characterId = null;
            const fetchPromise1 = fetch(characterIDAPI, {
                    method: "POST",
                    headers: characterAPIheaders,
                    timeout: 10000,
                    body: characterAPIbody,
                })
                .then(response => response.json())
                .then(async response => {
                    characterId = response.characters[0].id;


                    // check if the character section exists
                    if (!response.characters) {
                        console.log(`The character ${characterName} does not exist.`);
                        console.log(''); //blank line
                        return interaction.editReply(`${characterName} is not a valid character.`);
                    }
                    
                })
                .catch(error => {
                    console.log(`Error fetching character ID: ${error}`);
                    errorFlag = true;
                    return interaction.editReply(`${characterName} was not found.`);
                });
                fetchPromises.push(fetchPromise1);
                //wait for fetchPromise1 to resolve
                await fetchPromise1
                .then(async () => {
                    console.log('fetchPromise1 resolved');

                    console.log(`The character ID for ${characterName} is ${characterId}.`);

                    //return if the character ID is null
                    if (characterId == null) {
                        return;
                    }

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
                    const fetchPromise2 = fetch(apiUrl, {
                        headers: headers,
                        timeout: 10000
                    })
                    .then(response => response.json())
                    .then(async response => {

                        // Check if there was a kill found
                        if (response.length === 0) {
                            await interaction.editReply(`${characterName} has no recent kills.`);
                            return;
                        }

                        // Extract the kill details
                        const kill = response[0];
                        const killId = kill.killmail_id;



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

                        

                    })
                    .catch(error => {
                        if (error.message === 'ReferenceError: response is not defined') {
                            console.log(`Error fetching kill data: ${error}`);
                            errorFlag = true;
                            return interaction.editReply(`${characterName} has no (recent) kill history.`);
                        } else {
                            console.log(`Error fetching kill data: ${error}`);
                            errorFlag = true;
                            //dump response
                            console.log(response);
                            return interaction.editReply(`Error fetching kill data: ${error}. Bot may be rate limited.\nPlease try again later.`);

                        }
                    });
                    fetchPromises.push(fetchPromise2);
                });
        }

        // Wait for all of the fetch promises to resolve
        await Promise.all(fetchPromises)
            .then(async () => {
                //check for errors
                if (errorFlag) {
                    return;
                }

                //check killmailHashes and killmailIds for duplicates
                var numDuplicates = 0;
                var uniqueHashes = [];
                var uniqueIds = [];
                for (let i = 0; i < killmailHashes.length; i++) {
                    if (!uniqueHashes.includes(killmailHashes[i])) {
                        uniqueHashes.push(killmailHashes[i]);
                        uniqueIds.push(killmailIds[i]);
                    }else{
                        console.log(`duplicate found: ${killmailIds[i]} ${killmailHashes[i]}`);
                        numDuplicates++;
                    }
                }
                var numkills = await getNumberOfKills(uniqueIds, uniqueHashes, numDuplicates);
                if (numkills == null) {
                    return;
                }

                //update the recentRequests.json file
                recentRequests[interaction.user.id] = Date.now();
                fs.writeFileSync('recentKillRequests.json', JSON.stringify(recentRequests));

                // Send the kill details as a reply
                //if the total kills is greater than or equal to 200, add  a + to the end
                //the last 3 characters of numkills are usually the number of kills
                if (numkills.slice(-3) >= 200) {
                    if (numCharacters > 1) {
                        return interaction.editReply(`Characters have at least ${numkills}+ total kills.`);
                    } else {
                        return interaction.editReply(`${characterNames[0]} has at least ${numkills}+ total kills.`);
                    }
                } else {
                    if (numCharacters > 1) {
                        return interaction.editReply(`Characters have ${numkills} total kills.`);
                    } else {
                        return interaction.editReply(`${characterNames[0]} has ${numkills} total kills.`);
                    }
                };
            })
            .catch(error => {
                console.log(`Error fetching kill data: ${error}`);
                return interaction.editReply(`Error fetching kill data: ${error}. Bot may be rate limited.\nPlease try again later.`);
            });

    },
};

//return the number of kills in the last 30 days
function getNumberOfKills(killmailIds, killmailHashes, totalKillsOffset = 0) {
    const requestHeaders = {
        "Accept": "application/json",
        "cache-control": "no-cache"
    };

    var errorFlag = false;

    // map the killmail ids and hashes to an array of promises
    const requests = killmailIds.map((id, index) => {

        // TODO: stop requesting killmails if the we have reached 30 days ago

        const requestAPI = `https://esi.evetech.net/latest/killmails/${id}/${killmailHashes[index]}/?datasource=tranquility`;
        return fetch(requestAPI, {
                method: "GET",
                headers: requestHeaders,
                timeout: 10000
            })
            .then(response => response.json())
            .then(response => response)
            .catch(error => {
                console.log(`Error fetching killmail data: ${error}`);
                errorFlag = true;
                return interaction.editReply(`Error fetching killmail data: ${error}. Bot may be rate limited.\nPlease try again later.`);;
            });
    });
    // wait for all promises to resolve
    return Promise.all(requests).then(killmailData => {
        //check for errors
        if (errorFlag) {
            return null;
        }
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
        numberOfKills = numberOfKills.toString() + " accepted out of " + (totalKills + totalKillsOffset).toString();


        // return the number of kills in the last 30 days
        console.log(`The number of kills in the last 30 days is ${numberOfKills}.`);
        console.log(`The total number of kills is ${totalKills}.`);
        return numberOfKills;
    });
}
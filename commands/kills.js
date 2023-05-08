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

//if multiple people run the command at the same time, tthe log would be messed up
//so we save all logs to a variable and then write it to the log file at the end
//this also comes with the problem that if the bot crashes, the log file will not be updated
let log = '';

const {
    SlashCommandBuilder
} = require('discord.js');

const fetch = require('@adobe/node-fetch-retry');

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

        log += '\n----------------------------------- NEW ENTRY -----------------------------------\n';
        log += 'Entry type: kills.js\n';
        log += `command called by ${interaction.user.tag} at ${interaction.user.createdAt} on ${interaction.guild.name} in ${interaction.channel.name}\n`;


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
                log += `Time since last request: ${timeSinceLastRequest} seconds.\n`;
                const minutes = Math.floor((300 - timeSinceLastRequest) / 60);
                const seconds = Math.floor((300 - timeSinceLastRequest) % 60);
                log += `User ${interaction.user.tag} has made a request in the last 5 minutes. Please wait ${minutes} minutes and ${seconds} seconds before making another request.\n`;
                return interaction.editReply(`You have made a request in the last 5 minutes. Please wait ${minutes} minutes and ${seconds} seconds before making another request.`);
            }
        } else {
            //add the user to the recentRequests.json file
            recentRequests[interaction.user.id] = Date.now();
            fs.writeFileSync('recentKillRequests.json', JSON.stringify(recentRequests));
        }

        let numCharacters = 1;
        //if player2 or player3 is not null, then numCharacters = 2, if both are not null, then numCharacters = 3
        //because of discord, player3 can be used even if player2 is null
        if (interaction.options.getString('player2') != null) {
            numCharacters++;
        }
        if (interaction.options.getString('player3') != null) {
            numCharacters++;
        }
        log += `numCharacters is ${numCharacters}\n`;

        //get the character names
        const characterNames = [];
        for (let i = 0; i < numCharacters; i++) {
            characterNames[i] = interaction.options.getString(`player${i + 1}`);
            log += `characterNames[${i}] is ${characterNames[i]}\n`;
        }

        try {

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
                const characterName = characterNames[i];
                log += `characterName is ${characterName}\n`;
                const characterAPIbody = JSON.stringify([characterName]);
                let characterId = null;
                const fetchPromise1 = fetch(characterIDAPI, {
                    retryOptions: {
                        retryOnHttpError: function (error) {
                            return true;
                        },
                        retryMaxDuration: 20000,  // 20s retry max duration
                        retryInitialDelay: 500,
                        retryBackoff: 1.0 // no backoff
                    },
                    method: "POST",
                    headers: characterAPIheaders,
                    timeout: 20000,
                    body: characterAPIbody,
                })
                    .then(response => {
                        if (response.status != 200) {
                            log += `esi id response code: ${response.status}\n`;
                        }
                        return response.json();
                    })
                    .then(async response => {
                        characterId = response.characters[0].id;

                        // check if the character section exists
                        if (!response.characters) {
                            log += `The character ${characterName} does not exist.\n`;
                            throw (`${characterName} is not a valid character.`);
                        }

                    })
                    .catch(error => {
                        log += `Error fetching character ID: ${error}\n`;
                        throw (error);
                    });
                fetchPromises.push(fetchPromise1);
                //wait for fetchPromise1 to resolve
                await fetchPromise1
                    .then(async () => {
                        log += 'fetchPromise1 resolved\n';
                        log += `The character ID for ${characterName} is ${characterId}.\n`;

                        //return if the character ID is null
                        if (characterId == null) {
                            throw (`${characterName} was not found.`);
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
                            retryOptions: {
                                retryOnHttpError: function (error) {
                                    return true;
                                },
                                retryMaxDuration: 20000,  // 20s retry max duration
                                retryInitialDelay: 500,
                                retryBackoff: 1.0 // no backoff
                            },
                            headers: headers,
                            timeout: 20000
                        })
                            .then(response => {
                                if (response.status !== 200) {
                                    log += `zkill response code: ${response.status}\n`;
                                }
                                return response.json();
                            })
                            .then(async response => {

                                // Check if there was a kill found
                                if (response.length === 0) {
                                    throw (`${characterName} has no (recent) kill history.`);
                                }

                                // Extract the kill details
                                const kill = response[0];
                                const killId = kill.killmail_id;


                                // Get all the killmail hashes
                                for (let i = 0; i < response.length; i++) {
                                    const killmailHash = response[i].zkb.hash;
                                    killmailHashes.push(killmailHash);
                                }

                                // Get all the killmail IDs
                                for (let i = 0; i < response.length; i++) {
                                    const killmailId = response[i].killmail_id;
                                    killmailIds.push(killmailId);
                                }
                            })
                            .catch(error => {
                                log += `Error fetching kill data: ${error}\n`;
                                throw (`Error fetching kill data: ${error}.\nBot may be rate limited. Please try again later.`);
                            });
                        fetchPromises.push(fetchPromise2);

                        //wait for fetchPromise2 to resolve or reject
                        await fetchPromise2.catch(error => {
                            log += `await promise2 catch ${error}\n`;
                            throw error;
                        });
                    }).catch(error => {
                        log += `await promise1 catch ${error}\n`;
                        throw error;
                    });

            }

            // Wait for all the fetch promises to resolve
            await Promise.all(fetchPromises)
                .then(async () => {
                    //check for errors by looking for nulls in killmailIds
                    for (let i = 0; i < killmailIds.length; i++) {
                        if (killmailIds[i] == null) {
                            throw (`${characterNames[i]} is not a valid character.`);
                        }
                    }

                    //check killmailHashes and killmailIds for duplicates
                    let numDuplicates = 0;
                    const uniqueHashes = [];
                    const uniqueIds = [];
                    for (let i = 0; i < killmailHashes.length; i++) {
                        if (!uniqueHashes.includes(killmailHashes[i])) {
                            uniqueHashes.push(killmailHashes[i]);
                            uniqueIds.push(killmailIds[i]);
                        } else {
                            log += `duplicate found: ${killmailIds[i]} ${killmailHashes[i]}\n`;
                            numDuplicates++;
                        }
                    }
                    const numkills = await getNumberOfKills(uniqueIds, uniqueHashes, numDuplicates, interaction);
                    //if numkills starts with Error, throw it
                    if (numkills.startsWith('Error')) {
                        throw (numkills);
                    }

                    //update the recentRequests.json file
                    recentRequests[interaction.user.id] = Date.now();
                    ////----fs.writeFileSync('recentKillRequests.json', JSON.stringify(recentRequests));

                    //update the log file
                    console.log(log);

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
                    }
                })
                .catch(error => {
                    log += `Error processinng data: ${error}\n`;
                    throw `Error processinng data: ${error}`
                });
        } catch (e) {
            log += `Outside error catch: ${e}\n`;
            console.log(log);
            return interaction.editReply(`Error: ${e}`);
        }
    },
};

//return the number of kills in the last 30 days
function getNumberOfKills(killmailIds, killmailHashes, totalKillsOffset = 0, interaction) {
    const requestHeaders = {
        "accept": "application/json",
        "Cache-control": "no-cache"
    };

    // map the killmail ids and hashes to an array of promises
    const requests = killmailIds.map((id, index) => {

        // TODO: stop requesting killmails if the we have reached 30 days ago


        const requestAPI = `https://esi.evetech.net/latest/killmails/${id}/${killmailHashes[index]}/?datasource=tranquility`;
        return fetch(requestAPI, {
            retryOptions: {
                retryOnHttpError: function (error) {
                    return true;
                },
                retryMaxDuration: 20000,  // 20s retry max duration
                retryInitialDelay: 500,
                retryBackoff: 1.0 // no backoff
            },
            method: "GET",
            headers: requestHeaders,
            timeout: 20000
        })
            .then(response => {
                if (response.status !== 200) {
                    log += `esi response code: ${response.status}\n`;
                }
                return response.json();
            })
            .then(response => response)
            .catch(error => {
                log += `Error fetching killmail data: ${error}\n`;
            });
    });
    // wait for all promises to resolve
    return Promise.all(requests).then(killmailData => {
        //check for errors
        if (killmailData.length != killmailHashes.length) {
            log += `Error: killmailData length: ${killmailData.length}\nkillmailIds length: ${killmailHashes.length}\n`;
            return (`Error fetching killmail data: ${error}. Bot may be rate limited.\nPlease try again later.`);
        }
        // find the amount of kills in the last 30 days (time format is YYYY-MM-DDTHH:MM:SSZ)
        const today = new Date();
        let numberOfKills = 0;
        let totalKills = 0;
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
                        log += `Victim is blacklisted: ${killmailData[i].killmail_id}\n`;
                    }
                } else {
                    log += `Victim is friendly: ${killmailData[i].killmail_id}\n`;
                }
                totalKills++;
            }
        }
        //combine the number of kills and the total number of kills into a string
        numberOfKills = numberOfKills.toString() + " accepted out of " + (totalKills).toString();


        // return the number of kills in the last 30 days
        log += `The number of kills in the last 30 days is ${numberOfKills}.\n`;
        log += `The total number of kills is ${totalKills}.\n`;
        return numberOfKills;
    });
}
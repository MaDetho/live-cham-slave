const { HLTV } = require('hltv');
const TelegramBot = require('node-telegram-bot-api');
const TOKEN = process.env.TELEGRAM_TOKEN || '565495861:AAFD8f1OFJ1OsaN6nGhqP-_pwjIA3We8HKg';
const port = process.env.PORT || 8443;
const url = process.env.APP_URL || 'https://livechamslave.herokuapp.com:443';

//Dev
const bot = new TelegramBot(TOKEN, {polling: true});

//Prod
//const bot = new TelegramBot(TOKEN, {webHook: {port: port}});
//bot.setWebHook(`${url}/bot${TOKEN}`);

let isWatching = false;
let liveMatch;
bot.onText(/\/live (\d{7})/, async (msg, match) => {
    if (!isWatching) {
        let matchId = match[1];
        //First try to get the match
        let fullMatch = await HLTV.getMatch({ id: matchId });
        //Check if match is valid and live
        if (fullMatch && fullMatch.live) {
            let roundData = {};
            let pinnedMessage = await bot.sendMessage(msg.chat.id, "Fetching...");

            updateMessage(fullMatch, null, msg.chat.id, pinnedMessage.message_id);

            //Connect to livefeed
            liveMatch = HLTV.connectToScorebot({
                id: matchId, onScoreboardUpdate: (scoreboard) => {
                    if(roundData.ctTeamName !== scoreboard.ctTeamName) {
                        roundData.ctTeamName = scoreboard.ctTeamName;
                        roundData.tTeamName = scoreboard.terroristTeamName;
                    }
                    roundData.currentMapName = scoreboard.mapName;
                }, onLogUpdate: (data) => {
                    if (isWatching) {
                        switch (Object.keys(data.log[0])[0]) {
                            case "Kill": {
                                roundData.lastStatus = getKillFeed(data.log[0].Kill);
                                updateMessage(fullMatch, roundData, msg.chat.id, pinnedMessage.message_id);
                                break;
                            }
                            case "RoundStart": {
                                roundData.lastStatus = "Round started..";
                                updateMessage(fullMatch, roundData, msg.chat.id, pinnedMessage.message_id);
                                break;
                            }
                            case "BombPlanted": {
                                roundData.lastStatus = getBombPlantFeed(data.log[0].BombPlanted);
                                updateMessage(fullMatch, roundData, msg.chat.id, pinnedMessage.message_id);
                                break;
                            }
                            case "BombDefused": {
                                roundData.lastStatus = getBombDefusedFeed(data.log[0].BombDefused);
                                updateMessage(fullMatch, roundData, msg.chat.id, pinnedMessage.message_id);
                                break;
                            }
                            case "RoundEnd": {
                                roundData.roundEnd = data.log[0].RoundEnd;
                                roundData.lastStatus += " | " + roundData.roundEnd.winner + " won - " + roundData.roundEnd.winType;
                                updateMessage(fullMatch, roundData, msg.chat.id, pinnedMessage.message_id);
                                break;
                            }
                        }
                    } else {
                        liveMatch = null;
                    }
                }, onConnect: () => {
                    isWatching = true;
                    sendMessage(msg.chat.id, "Connected to match!");
                }, onDisconnect: () => {
                    isWatching = false;
                    sendMessage(msg.chat.id, "Error: Disconnected to match!");
                    throw 'cancel';
                }
            }).catch(err => {
                sendMessage(msg.chat.id, "Some error happend: Canceled watching match!");
            });
        } else if (!fullMatch) {
            sendMessage(msg.chat.id, "Match is invalid!");
        } else if (!fullMatch.live) {
            sendMessage(msg.chat.id, "Match is not live yet!");
        }
    } else {
        sendMessage(msg.chat.id, "Allready watching a match. Please use /stop first to watch a new match!");
    }
});

bot.onText(/\/stop/, (msg) => {
    if(isWatching) {
        isWatching = false;
        liveMatch = null;
        sendMessage(msg.chat.id, "Stopped watching match.");
    }
});

function getKillFeed(killData) {
    let killFeed = "";
    killFeed += killData.killerNick;
    killFeed += " " + (killData.headShot ? "\u{1F480}" : "\u{1F44A}") + " ";
    killFeed += killData.victimNick;
    return killFeed
}

function getBombPlantFeed(bombPlantData) {
    let bombPlantFeed = "";
    bombPlantFeed += bombPlantData.playerName;
    bombPlantFeed += " planted \u{1F4A3} ";
    bombPlantFeed += "(" + bombPlantData.tPlayers + "on" + bombPlantData.ctPlayers + ")";
    return bombPlantFeed
}

function getBombDefusedFeed(bombDefusedData) {
    let bombDefusedFeed = bombDefusedData.playerNick;
    bombDefusedFeed += " defused \u{1F527}";
    return bombDefusedFeed
}

function getRoundEndFeed(roundData, fullMatch) {
    let roundEndFeed = fullMatch.team1.name + " vs. " + fullMatch.team2.name + " - Waiting for round end..";
    if(roundData.roundEnd) {
        roundEndFeed = roundData.ctTeamName + " (CT) " + roundData.roundEnd.counterTerroristScore + " - " + roundData.roundEnd.terroristScore + " (T) " + roundData.tTeamName;
    }
    roundEndFeed += " | " + roundData.currentMapName + (roundData.lastStatus ? ( " | " + roundData.lastStatus) : "");
    return roundEndFeed
}

function getSideSmall(side) {
    return side === "TERRORIST" ? "T" : side;
}

function sendMessage(chatId, roundFeed) {
    bot.sendMessage(chatId, roundFeed);
}

function editMessage(chatId, messageId, roundFeed) {
    bot.editMessageText(roundFeed, {chat_id: chatId, message_id: messageId});
}

function getStaticMatchDataString(fullMatch) {
    let staticFullMatchString = "\n\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n";
    staticFullMatchString += "Format: " + fullMatch.format + "\n";
    staticFullMatchString += "\nMaps: \n";
    fullMatch.maps.forEach(map => {
        staticFullMatchString += map.name + (map.result ? (" - " + map.result) : "") + "\n";
    });
    staticFullMatchString += "\nStreams: \n";
    fullMatch.streams.forEach(stream => {
        if("HLTV Live" !== stream.name)
            staticFullMatchString += stream.name + " [" + stream.viewers + "] - " + stream.link + "\n";
    });
    return staticFullMatchString;
}

function updateMessage(fullMatch, roundData, chatId, messageId) {
    let roundMessage = "";
    if(fullMatch) {
        if(!roundData) {
            roundMessage += fullMatch.team1.name + " vs. " + fullMatch.team2.name + " - Waiting for round end..";
            roundMessage += getStaticMatchDataString(fullMatch);
        } else {
            roundMessage += getRoundEndFeed(roundData, fullMatch);
            roundMessage += getStaticMatchDataString(fullMatch);
        }
    }

    editMessage(chatId, messageId, roundMessage);
}

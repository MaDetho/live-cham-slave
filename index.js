const { HLTV } = require('hltv');
const TelegramBot = require('node-telegram-bot-api');
const TOKEN = process.env.TELEGRAM_TOKEN || '565495861:AAFD8f1OFJ1OsaN6nGhqP-_pwjIA3We8HKg';
const port = process.env.PORT || 8443;
const url = process.env.APP_URL || 'https://livechamslave.herokuapp.com:443';
const bot = new TelegramBot(TOKEN, {webHook: {port: port}});

bot.setWebHook(`${url}/bot${TOKEN}`);

let isWatching = false;
bot.onText(/\/live (\d{7})/, (msg, match) => {
    let roundFeed = "";
    let matchId = match[1];

    if (!isWatching) {
        //First try to get the match
        HLTV.getMatch({ id: matchId }).then(match => {
            //Check if match ist valid
            if (match && match.live) {
                sendMessage(msg.chat.id, "Started watching: " + match.team1.name + " vs. " + match.team2.name);

                let roundFeed = "";
                //Connect to livefeed
                let livematch = HLTV.connectToScorebot({
                    id: matchId, onScoreboardUpdate: (data) => {

                    }, onLogUpdate: (data) => {
                        if (isWatching) {
                            switch (Object.keys(data.log[0])[0]) {
                                case "Kill": {
                                    roundFeed += getKillFeed(data.log[0].Kill) + "\n";
                                    break;
                                }
                                case "RoundStart": {
                                    roundFeed = "";
                                    break;
                                }
                                case "BombPlanted": {
                                    roundFeed += getBombPlantFeed(data.log[0].BombPlanted) + "\n";
                                    break;
                                }
                                case "BombDefused": {
                                    roundFeed += getBombDefusedFeed(data.log[0].BombDefused) + "\n";
                                    break;
                                }
                                case "RoundEnd": {
                                    roundFeed += getRoundEndFeed(data.log[0].RoundEnd);
                                    sendMessage(msg.chat.id, roundFeed);
                                    break;
                                }
                            }
                        } else {
                            livematch = null;
                        }
                    }, onConnect: () => {
                        isWatching = true;
                        sendMessage(msg.chat.id, "We are live bois!");
                    }, onDisconnect: () => {
                        isWatching = false;
                        sendMessage(msg.chat.id, "We disconnected!");
                        throw 'cancel';
                    }
                }).catch(err => {
                    sendMessage(msg.chat.id, "Some error happend: Canceled watching match!");
                });
            } else if (!match) {
                sendMessage(msg.chat.id, "Match is invalid!");
            } else if (!match.live) {
                sendMessage(msg.chat.id, "Match is not live yet!");
            }
        })
    } else {
        sendMessage(msg.chat.id, "Allready watching a match!");
    }
});

bot.onText(/\/stop/, (msg, match) => {
    if(isWatching) {
        isWatching = false;
        sendMessage(msg.chat.id, "Stopped watching match");
    }
});

getKillFeed = (killData) => {
    let killFeed = "";
    killFeed += killData.killerNick;
    killFeed += "(" + getSideSmall(killData.killerSide) + ")";
    killFeed += " killed ";
    killFeed += killData.victimNick;
    killFeed += "(" + getSideSmall(killData.victimSide) + ")";
    killFeed += " with";
    killFeed += " " + killData.weapon;
    killFeed += " " + (killData.headShot ? "(hs)" : "");
    return killFeed
}

getBombPlantFeed = (bombPlantData) => {
    let bombPlantFeed = "";
    bombPlantFeed += bombPlantData.playerName;
    bombPlantFeed += " planted the bomb ";
    bombPlantFeed += "(" + bombPlantData.tPlayers + "on" + bombPlantData.ctPlayers + ")";
    return bombPlantFeed
}

getBombDefusedFeed = (bombDefusedData) => {
    let bombDefusedFeed = bombDefusedData.playerNick;
    bombDefusedFeed += " defused the bomb";
    return bombDefusedFeed
}

getRoundEndFeed = (roundEndtData) => {
    let roundEndFeed = "Round over - Winner: "
    roundEndFeed += roundEndtData.winner;
    roundEndFeed += " - " + roundEndtData.winType;
    roundEndFeed += "\n";
    roundEndFeed += "SCORE CT " + roundEndtData.counterTerroristScore + "-" + roundEndtData.terroristScore + " T";
    return roundEndFeed
}

getSideSmall = (side) => {
    return side === "TERRORIST" ? "T" : side;
}

sendMessage = (chatid, roundFeed) => {
    bot.sendMessage(chatid, roundFeed);
}
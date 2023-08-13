const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('player')
		.setDescription('Get a player\'s profile from Infecta\'s osu server')
		.addStringOption((option) =>
			option.setName('player').setDescription('Player name'),
		)
		.addStringOption((option) =>
			option.setName('mode')
				.setDescription('Game mode')
				.addChoices(
					{ name: 'osu!', value: 'standard' },
					{ name: 'osu!rx', value: 'standard-rx' },
					{ name: 'taiko', value: 'taiko' },
					{ name: 'taiko!rx', value: 'taiko-rx' },
					{ name: 'ctb', value: 'ctb' },
					{ name: 'ctb!rx', value: 'ctb-rx' },
					{ name: 'mania', value: 'mania' },
				),
		),
	async execute(interaction) {
		const userInput = interaction.options.getString('player', false);
		const mode = interaction.options.getString('mode');

		const apiEndpoint = process.env.osuEndPoint;

		// Query Database Function for looking up playerIDs by discord userIDs
		async function queryDB(userID) {
			const mongoClient = new MongoClient(process.env.mongoUri);
			const db = mongoClient.db(process.env.mongoDatabase);
			const collection = db.collection('players');

			try {
				const playerData = await collection.findOne({ userID });

				return playerData;
			}
			catch (err) {
				console.error(err);
			}
			finally {
				mongoClient.close();
			}
		}

		// Main Player stat querying function
		async function queryStats(playerID) {
			const queryInfo = await fetch(
				`${apiEndpoint}/v1/get_player_info?id=${playerID}&scope=all`,
			);
			const queryRes = await queryInfo.json();
			const playerProperties = queryRes.player;

			return playerProperties;
		}

		async function queryID(playerName) {
			const queryPlayerID = await fetch(`${apiEndpoint}/v2/players`);
			const queryRes = await queryPlayerID.json();
			const playerArray = queryRes.data;

			const playerMap = new Map();
			playerArray.forEach((player) =>
				playerMap.set(player.safe_name, player.id),
			);

			try {
				const playerID = playerMap.get(playerName);
				return playerID;
			}
			catch (err) {
				interaction.reply({
					content: 'Player name does not exist',
					ephemeral: true,
				});
				return;
			}
		}

		let embedDialog;
		let selectedMode;

		switch (mode) {
		case 'standard':
			embedDialog = 'osu!standard';
			selectedMode = 0;
			break;
		case 'standard-rx':
			embedDialog = 'osu!standard RX';
			selectedMode = 4;
			break;
		case 'taiko':
			embedDialog = 'osu!taiko';
			selectedMode = 1;
			break;
		case 'taiko-rx':
			embedDialog = 'osu!taiko RX';
			selectedMode = 5;
			break;
		case 'ctb':
			embedDialog = 'osu!ctb';
			selectedMode = 2;
			break;
		case 'ctb-rx':
			embedDialog = 'osu!ctb RX';
			selectedMode = 6;
			break;
		case 'mania':
			embedDialog = 'osu!mania';
			selectedMode = 3;
			break;
		default:
			embedDialog = 'osu!standard';
			selectedMode = 0;
		}

		if (!userInput) {
			queryDB(interaction.user.id).then((DBResponse) => {
				try {
					queryStats(DBResponse.playerID).then(async (player) => {
						try {
							const playerStats = player.stats[`${selectedMode}`];

							const elapsedPlaytime = playerStats.playtime / 60;

							const rankXH = '<:rankXH:1140241188595703830>';
							const rankX = '<:rankX:1140241185059913830>';
							const rankSH = '<:rankSH:1140241183357014087>';
							const rankS = '<:rankS:1140241180089647114>';
							const rankA = '<:rankA:1140241164650426451>';

							// Unix timestamp of the user's last activity
							const lastActivityTimestamp = player.info.latest_activity;

							// Current Unix timestamp
							const currentTimestamp = Math.floor(Date.now() / 1000);

							// Calculate the time difference in seconds
							const timeDifference = currentTimestamp - lastActivityTimestamp;

							// Define time intervals in seconds
							const minute = 60;
							const hour = minute * 60;
							const day = hour * 24;
							const week = day * 7;
							const month = day * 30;
							const year = day * 365;

							// Determine the appropriate time unit to display
							let relativeTime;
							if (timeDifference < minute) {
								relativeTime = `${timeDifference} seconds ago`;
							}
							else if (timeDifference < hour) {
								relativeTime = `${Math.floor(timeDifference / minute)} minutes ago`;
							}
							else if (timeDifference < day) {
								relativeTime = `${Math.floor(timeDifference / hour)} hours ago`;
							}
							else if (timeDifference < week) {
								relativeTime = `${Math.floor(timeDifference / day)} days ago`;
							}
							else if (timeDifference < month) {
								relativeTime = `${Math.floor(timeDifference / week)} weeks ago`;
							}
							else if (timeDifference < year) {
								relativeTime = `${Math.floor(timeDifference / month)} months ago`;
							}
							else {
								relativeTime = `${Math.floor(timeDifference / year)} years ago`;
							}

							const embed = new EmbedBuilder()
								.setTitle(`${embedDialog} player stats for ${player.info.name}`)
								.setThumbnail(`https://a.infecta.xyz/${player.info.id}`)
								.setDescription(
									`
									**▸ Server-wide Rank:** #${playerStats.rank}
									**▸ PP:** ${(playerStats.pp).toLocaleString()}PP
									**▸ Acc:** ${(Math.round(playerStats.acc * 100) / 100).toFixed(2)}%
									**▸ Playcount:** ${playerStats.plays.toLocaleString()} (${elapsedPlaytime.toFixed(0)} mins.)
									**▸ Ranks:** ${rankXH} \`\`${playerStats.xh_count}\`\` ${rankX} \`\`${playerStats.x_count}\`\` ${rankSH} \`\`${playerStats.sh_count}\`\` ${rankS} \`\`${playerStats.s_count}\`\` ${rankA} \`\`${playerStats.a_count}\`\`
									`,
								)
								.setFooter({ text: `Last Seen ${relativeTime} in Infecta's osu! server` });

							await interaction.reply({ embeds: [embed] });
						}
						catch (err) {
							interaction.reply({
								content: 'If you\'re seeing this, something went extremely wrong in the backend lol',
								ephemeral: true,
							});
						}
					});
				}
				catch (err) {
					interaction.reply({
						content: 'It seems like you haven\'t binded your osu account to your Discord yet. Do so with **/osu-bind**',
						ephemeral: true,
					});
				}
			});

			return;
		}
		else {
			queryID(userInput.toLowerCase()).then((id) => {
				queryStats(id).then(async (player) => {
					try {
						const playerStats = player.stats[`${selectedMode}`];

						const elapsedPlaytime = playerStats.playtime / 60;

						const rankXH = '<:rankXH:1140241188595703830>';
						const rankX = '<:rankX:1140241185059913830>';
						const rankSH = '<:rankSH:1140241183357014087>';
						const rankS = '<:rankS:1140241180089647114>';
						const rankA = '<:rankA:1140241164650426451>';

						// Unix timestamp of the user's last activity
						const lastActivityTimestamp = player.info.latest_activity;

						// Current Unix timestamp
						const currentTimestamp = Math.floor(Date.now() / 1000);

						// Calculate the time difference in seconds
						const timeDifference = currentTimestamp - lastActivityTimestamp;

						// Define time intervals in seconds
						const minute = 60;
						const hour = minute * 60;
						const day = hour * 24;
						const week = day * 7;
						const month = day * 30;
						const year = day * 365;

						// Determine the appropriate time unit to display
						let relativeTime;
						if (timeDifference < minute) {
							relativeTime = `${timeDifference} seconds ago`;
						}
						else if (timeDifference < hour) {
							relativeTime = `${Math.floor(timeDifference / minute)} minutes ago`;
						}
						else if (timeDifference < day) {
							relativeTime = `${Math.floor(timeDifference / hour)} hours ago`;
						}
						else if (timeDifference < week) {
							relativeTime = `${Math.floor(timeDifference / day)} days ago`;
						}
						else if (timeDifference < month) {
							relativeTime = `${Math.floor(timeDifference / week)} weeks ago`;
						}
						else if (timeDifference < year) {
							relativeTime = `${Math.floor(timeDifference / month)} months ago`;
						}
						else {
							relativeTime = `${Math.floor(timeDifference / year)} years ago`;
						}

						const embed = new EmbedBuilder()
							.setTitle(`${embedDialog} player stats for ${player.info.name}`)
							.setThumbnail(`https://a.infecta.xyz/${player.info.id}`)
							.setDescription(
								`
								**▸ Server-wide Rank:** #${playerStats.rank}
								**▸ PP:** ${(playerStats.pp).toLocaleString()}PP
								**▸ Acc:** ${(Math.round(playerStats.acc * 100) / 100).toFixed(2)}%
								**▸ Playcount:** ${playerStats.plays.toLocaleString()} (${elapsedPlaytime.toFixed(0)} mins.)
								**▸ Ranks:** ${rankXH} \`\`${playerStats.xh_count}\`\` ${rankX} \`\`${playerStats.x_count}\`\` ${rankSH} \`\`${playerStats.sh_count}\`\` ${rankS} \`\`${playerStats.s_count}\`\` ${rankA} \`\`${playerStats.a_count}\`\`
								`,
							)
							.setFooter({ text: `Last Seen ${relativeTime} in Infecta's osu! server` });

						await interaction.reply({ embeds: [embed] });
					}
					catch (err) {
						interaction.reply({
							content: 'Something went wrong (Either API is down or you misspelled the username)',
							ephemeral: true,
						});
					}
				});
			});
		}
	},
};

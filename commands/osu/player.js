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

							const embed = new EmbedBuilder()
								.setTitle(`${embedDialog} player stats for ${player.info.name}`)
								.setThumbnail(`https://a.infecta.xyz/${player.info.id}`)
								.addFields(
									{ name: 'Rank (Server-wide)', value: `#${playerStats.rank}` },
									{
										name: 'Accuracy',
										value: `${(Math.round(playerStats.acc * 100) / 100).toFixed(2)}%`,
										inline: true,
									},
									{ name: 'PP', value: `${(playerStats.pp).toLocaleString()}PP`, inline: true },
									{
										name: 'Last Seen',
										value: `<t:${player.info.latest_activity}>`,
									},
								)
								.setFooter({ text: 'Stats fetched from Infecta\'s osu server' });

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
						const playerStats = player.stats[selectedMode];

						const embed = new EmbedBuilder()
							.setTitle(`${embedDialog} player stats for ${player.info.name}`)
							.setThumbnail(`https://a.infecta.xyz/${player.info.id}`)
							.addFields(
								{ name: 'Rank (Server-wide)', value: `#${playerStats.rank}` },
								{
									name: 'Accuracy',
									value: `${(Math.round(playerStats.acc * 100) / 100).toFixed(2)}%`,
									inline: true,
								},
								{ name: 'PP', value: `${(playerStats.pp).toLocaleString()}PP`, inline: true },
								{
									name: 'Last Seen',
									value: `<t:${player.info.latest_activity}>`,
								},
							)
							.setFooter({ text: 'Stats fetched from Infecta\'s osu server' });

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

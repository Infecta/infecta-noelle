const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('top')
		.setDescription('Query a player\'s top plays in Infecta\'s osu server')
		.addStringOption((option) =>
			option.setName('player').setDescription('Player Name'),
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
			const db = mongoClient.db('test');
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

		// Query Player ID if argument was given
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

		// Main Player stat querying function
		async function queryBest(playerID) {
			const queryInfo = await fetch(
				`${apiEndpoint}/v1/get_player_scores?id=${playerID}&mode=${selectedMode}&scope=best&limit=5`,
			);
			const queryRes = await queryInfo.json();
			const bestScores = queryRes;

			return bestScores;
		}

		// Bitwise mod detection
		const modifiers = {
			NM: 0,
			NF: 1,
			EZ: 2,
			TD: 4,
			HD: 8,
			HR: 16,
			SD: 32,
			DT: 64,
			RX: 128,
			HT: 256,
			NC: 512,
			FL: 1024,
			AU: 2048,
			SO: 4096,
			AP: 8192,
			PF: 16384,
			Key4: 32768,
			Key5: 65536,
			Key6: 131072,
			Key7: 262144,
			Key8: 524288,
			FadeIn: 1048576,
			Random: 2097152,
			Cinema: 4194304,
			Target: 8388608,
			Key9: 16777216,
			KeyCoop: 33554432,
			Key1: 67108864,
			Key3: 134217728,
			Key2: 268435456,
			ScoreV2: 536870912,
			Mirror: 1073741824,
		};

		function hasModifier(bitwiseSum, modifier) {
			return (bitwiseSum & modifiers[modifier]) !== 0;
		}

		function getEnabledMods(bitwiseSum) {
			const enabledModifiers = [];
			const excludedModifiers = new Set();

			for (const modifier in modifiers) {
				if (hasModifier(bitwiseSum, modifier)) {
					if (modifier === 'DT' && hasModifier(bitwiseSum, 'NC')) {
						// If Nightcore is implicitly enabled with DoubleTime, skip adding it to the list
						excludedModifiers.add(modifier);
					}
					else if (modifier === 'SD' && hasModifier(bitwiseSum, 'PF')) {
						// If Perfect is implicitly enabled with SuddenDeath, skip adding it to the list
						excludedModifiers.add(modifier);
					}
					else {
						enabledModifiers.push(modifier);
					}
				}

			}

			const filteredModifiers = enabledModifiers.filter((modifier) => !excludedModifiers.has(modifier));

			if (filteredModifiers.length === 0) {
				return 'No Mod';
			}

			return filteredModifiers.join('');
		}

		const errorEmbed = new EmbedBuilder()
			.setColor(0xc70770)
			.setAuthor({
				name: 'Not enough scores!',
			})
			.setDescription('I need at least 5 scores in your account for it to work!');

		if (!userInput) {
			queryDB(interaction.user.id).then((DBResponse) => {
				try {
					queryBest(DBResponse.playerID).then(async (scoreData) => {
						try {
							// Declare index for formatting later on
							let index = 1;
							// Turn scores into proper array
							const scores = scoreData.scores.slice(0, 5);
							let bestScores = '';

							if ((scoreData.scores).length === 0) {
								return interaction.reply({
									embeds: [errorEmbed],
									ephemeral: true,
								});
							}

							for (const score of scores) {
								const starDifficulty = score.beatmap.diff.toFixed(2);
								const accuracy = (Math.round(score.acc * 100) / 100).toFixed(2);
								const scoreMods = getEnabledMods(score.mods);
								const scoreFormatted = score.score.toLocaleString();
								const scoreDate = score.play_time;
								const scoreDateUnix = Date.parse(scoreDate) / 1000;

								bestScores += `**${index}) [${score.beatmap.title} [${
									score.beatmap.version
								}]](https://osu.ppy.sh/b/${
									score.beatmap.id
								}) +${scoreMods}** [${starDifficulty}★]\n▸ ${
									score.grade
								} ▸ ${accuracy}%\n▸ ${scoreFormatted} ▸ x${score.max_combo}/${
									score.beatmap.max_combo
								} ▸ [${score.n300 + score.ngeki}/${score.n100 + score.nkatu}/${
									score.n50
								}/${score.nmiss}]\n▸ Score Set  <t:${scoreDateUnix}:R>\n`;

								index++;
							}

							bestScores = bestScores.trim();

							// Embed Here

							const scoreEmbed = new EmbedBuilder()
								.setColor(0xc70770)
								.setAuthor({
									name: `Top ${embedDialog} Plays for ${scoreData.player.name}:`,
								})
								.setThumbnail(`https://a.infecta.xyz/${scoreData.player.id}`)
								.setDescription(`${bestScores}`)
								.setFooter({ text: 'On Infecta\'s osu! Server' });

							await interaction.reply({ embeds: [scoreEmbed] });
						}
						catch (err) {
							interaction.reply({
								content: 'If you\'re seeing this, something went extremely wrong in the backend lol',
								ephemeral: true,
							});
							console.error(err);
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
				queryBest(id).then(async (scoreData) => {
					try {
						// Declare index for formatting later on
						let index = 1;
						// Turn scores into proper array
						const scores = scoreData.scores.slice(0, 5);
						let bestScores = '';

						if ((scoreData.scores).length === 0) {
							return interaction.reply({
								embeds: [errorEmbed],
								ephemeral: true,
							});
						}

						for (const score of scores) {
							const starDifficulty = score.beatmap.diff.toFixed(2);
							const accuracy = (Math.round(score.acc * 100) / 100).toFixed(2);
							const scoreMods = getEnabledMods(score.mods);
							const scoreFormatted = score.score.toLocaleString();
							const scoreDate = score.play_time;
							const scoreDateUnix = Date.parse(scoreDate) / 1000;

							bestScores += `**${index}) [${score.beatmap.title} [${
								score.beatmap.version
							}]](https://osu.ppy.sh/b/${
								score.beatmap.id
							}) +${scoreMods}** [${starDifficulty}★]\n▸ ${
								score.grade
							} ▸ ${accuracy}%\n▸ ${scoreFormatted} ▸ x${score.max_combo}/${
								score.beatmap.max_combo
							} ▸ [${score.n300 + score.ngeki}/${score.n100 + score.nkatu}/${
								score.n50
							}/${score.nmiss}]\n▸ Score Set  <t:${scoreDateUnix}:R>\n`;

							index++;
						}

						bestScores = bestScores.trim();

						// Embed Here

						const scoreEmbed = new EmbedBuilder()
							.setColor(0xc70770)
							.setAuthor({
								name: `Top ${embedDialog} Plays for ${scoreData.player.name}:`,
							})
							.setThumbnail(`https://a.infecta.xyz/${scoreData.player.id}`)
							.setDescription(`${bestScores}`)
							.setFooter({ text: 'On Infecta\'s osu! Server' });

						await interaction.reply({ embeds: [scoreEmbed] });
					}
					catch (err) {
						interaction.reply({
							content: 'If you\'re seeing this, something went extremely wrong in the backend lol',
							ephemeral: true,
						});
						console.error(err);
					}
				});
			});
		}
	},
};

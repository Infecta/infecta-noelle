const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('recent')
		.setDescription('Query a player\'s recent scores in Infecta\'s osu server')
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
			break;
		}

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
		async function queryScore(playerID) {
			const queryInfo = await fetch(
				`${apiEndpoint}/v1/get_player_scores?id=${playerID}&mode=${selectedMode}&scope=recent&limit=1`,
			);
			const queryRes = await queryInfo.json();
			const scoreProperties = queryRes;

			return scoreProperties;
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

		if (!userInput) {
			queryDB(interaction.user.id).then((DBResponse) => {
				try {
					queryScore(DBResponse.playerID).then(async (scoreData) => {
						try {
							const playerInfo = scoreData.player;
							const scoreInfo = scoreData.scores[0];
							const beatmapData = scoreData.scores[0].beatmap;

							const ppFormated = scoreInfo.pp.toFixed(2);
							const accuracyFormatted = (
								Math.round(scoreInfo.acc * 100) / 100
							).toFixed(2);
							const starDifficulty = beatmapData.diff.toFixed(2);
							const scoreFormatted = scoreInfo.score.toLocaleString();

							const scoreMods = getEnabledMods(scoreInfo.mods);

							// console.log(scoreMods)
							// Embed Here

							const scoreEmbed = new EmbedBuilder()
								.setColor(0xc70770)
								.setAuthor({
									name: `${beatmapData.title} [${beatmapData.version}] +${scoreMods} [${starDifficulty}★]`,
									iconURL: `https://a.infecta.xyz/${playerInfo.id}`,
									url: `https://osu.ppy.sh/beatmapsets/${beatmapData.set_id}`,
								})
								.setThumbnail(
									`https://b.ppy.sh/thumb/${beatmapData.set_id}l.jpg`,
								)
								.setDescription(
									`▸ ${
										scoreInfo.grade
									} ▸ **${ppFormated}PP** ▸ ${accuracyFormatted}%\n▸ ${scoreFormatted} ▸ x${
										scoreInfo.max_combo
									}/${beatmapData.max_combo} ▸ [${
										scoreInfo.n300 + scoreInfo.ngeki
									}/${scoreInfo.n100 + scoreInfo.nkatu}/${scoreInfo.n50}/${
										scoreInfo.nmiss
									}]`,
								)
								.setFooter({ text: 'On Infecta\'s osu! Server' });

							await interaction.reply({
								content: `**Recent ${embedDialog} Play for ${playerInfo.name}:**`,
								embeds: [scoreEmbed],
							});
						}
						catch (err) {
							interaction.reply({ content: 'If you\'re seeing this, something went extremely wrong in the backend lol\n (Or player has no recent scores)', ephemeral: true });
							console.log(err);
						}
					});
				}
				catch (err) {
					interaction.reply({
						content:
              'It seems like you haven\'t binded your osu account to your Discord yet. Do so with **/osu-bind**',
						ephemeral: true,
					});
				}
			});

			return;
		}
		else {
			queryID(userInput.toLowerCase()).then((id) => {
				queryScore(id).then(async (scoreData) => {
					try {
						const playerInfo = scoreData.player;
						const scoreInfo = scoreData.scores[0];
						const beatmapData = scoreData.scores[0].beatmap;

						const ppFormated = scoreInfo.pp.toFixed(2);
						const accuracyFormatted = (
							Math.round(scoreInfo.acc * 100) / 100
						).toFixed(2);
						const starDifficulty = beatmapData.diff.toFixed(2);
						const scoreFormatted = scoreInfo.score.toLocaleString();

						const scoreMods = getEnabledMods(scoreInfo.mods);

						// console.log(scoreMods)
						// Embed Here

						const scoreEmbed = new EmbedBuilder()
							.setColor(0xc70770)
							.setAuthor({
								name: `${beatmapData.title} [${beatmapData.version}] +${scoreMods} [${starDifficulty}★]`,
								iconURL: `https://a.infecta.xyz/${playerInfo.id}`,
								url: `https://osu.ppy.sh/beatmapsets/${beatmapData.set_id}`,
							})
							.setThumbnail(`https://b.ppy.sh/thumb/${beatmapData.set_id}l.jpg`)
							.setDescription(
								`▸ ${
									scoreInfo.grade
								} ▸ **${ppFormated}PP** ▸ ${accuracyFormatted}%\n▸ ${scoreFormatted} ▸ x${
									scoreInfo.max_combo
								}/${beatmapData.max_combo} ▸ [${
									scoreInfo.n300 + scoreInfo.ngeki
								}/${scoreInfo.n100 + scoreInfo.nkatu}/${scoreInfo.n50}/${
									scoreInfo.nmiss
								}]`,
							)
							.setFooter({ text: 'On Infecta\'s osu! Server' });

						await interaction.reply({
							content: `**Recent ${embedDialog} Play for ${playerInfo.name}:**`,
							embeds: [scoreEmbed],
						});
					}
					catch (err) {
						console.log(err);
						interaction.reply({
							content:
                'Something went wrong (Either API is down or you misspelled the username)\n (Or player has no recent scores)',
							ephemeral: true,
						});
					}
				});
			});
		}
	},
};

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');
const { getEnabledMods } = require('../../commands_modules/modBitwiseCalc.js');
const { modeSelector } = require('../../commands_modules/modeSelector.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('top')
		.setDescription('Query a player\'s top plays in Infecta\'s osu server')
		.addStringOption((option) =>
			option.setName('player').setDescription('Player Name'),
		)
		.addStringOption((option) =>
			option
				.setName('mode')
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

		const modeSelection = modeSelector(mode);

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
		async function queryBest(playerID) {
			const queryInfo = await fetch(
				`${apiEndpoint}/v1/get_player_scores?id=${playerID}&mode=${modeSelection.selectedMode}&scope=best&limit=5`,
			);
			const queryRes = await queryInfo.json();
			const bestScores = queryRes;

			return bestScores;
		}

		const errorEmbed = new EmbedBuilder()
			.setColor(0xc70770)
			.setAuthor({ name: 'Not enough scores!' })
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

							if (scoreData.scores.length === 0) {
								return interaction.reply({
									embeds: [errorEmbed],
									ephemeral: true,
								});
							}

							for (const score of scores) {
								const starDifficulty = score.beatmap.diff.toFixed(2);
								const pp = score.pp.toFixed(2);
								const accuracy = (Math.round(score.acc * 100) / 100).toFixed(2);
								const scoreMods = getEnabledMods(score.mods);
								const scoreFormatted = score.score.toLocaleString();
								const scoreDate = score.play_time;
								const scoreDateUnix = Date.parse(scoreDate) / 1000;

								let rankingEmote;

								switch (score.grade) {
								case 'XH':
									rankingEmote = '<:rankXH:1140241188595703830>';
									break;
								case 'X':
									rankingEmote = '<:rankX:1140241185059913830>';
									break;
								case 'SH':
									rankingEmote = '<:rankSH:1140241183357014087>';
									break;
								case 'S':
									rankingEmote = '<:rankS:1140241180089647114>';
									break;
								case 'A':
									rankingEmote = '<:rankA:1140241164650426451>';
									break;
								case 'B':
									rankingEmote = '<:rankB:1140241166571421738>';
									break;
								case 'C':
									rankingEmote = '<:rankC:1140241170711187546>';
									break;
								case 'D':
									rankingEmote = '<:rankD:1140241174007906304>';
									break;
								case 'F':
									rankingEmote = '<:rankF:1140241177136861198>';
									break;
								default:
									rankingEmote = 'NoRank';
									break;
								}

								bestScores += `**${index}) [${score.beatmap.title} [${score.beatmap.version
								}]](https://osu.ppy.sh/b/${score.beatmap.id
								}) +${scoreMods}** [${starDifficulty}★]\n▸ ${rankingEmote
								} ▸ **${pp}PP** ▸ ${accuracy}%\n▸ ${scoreFormatted} ▸ x${score.max_combo
								}/${score.beatmap.max_combo} ▸ [${score.n300 + score.ngeki}/${score.n100 + score.nkatu
								}/${score.n50}/${score.nmiss
								}]\n▸ Score Set  <t:${scoreDateUnix}:R>\n`;

								index++;
							}

							bestScores = bestScores.trim();

							// Embed Here

							const scoreEmbed = new EmbedBuilder()
								.setColor(0xc70770)
								.setAuthor({
									name: `Top ${modeSelection.embedDialog} Plays for ${scoreData.player.name}:`,
								})
								.setThumbnail(`https://a.infecta.xyz/${scoreData.player.id}`)
								.setDescription(`${bestScores}`)
								.setFooter({ text: 'On Infecta\'s osu! Server' });

							await interaction.reply({ embeds: [scoreEmbed] });
						}
						catch (err) {
							interaction.reply({
								content:
									'If you\'re seeing this, something went extremely wrong in the backend lol',
								ephemeral: true,
							});
							console.error(err);
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
				queryBest(id).then(async (scoreData) => {
					try {
						// Declare index for formatting later on
						let index = 1;
						// Turn scores into proper array
						const scores = scoreData.scores.slice(0, 5);
						let bestScores = '';

						if (scoreData.scores.length === 0) {
							return interaction.reply({
								embeds: [errorEmbed],
								ephemeral: true,
							});
						}

						for (const score of scores) {
							const starDifficulty = score.beatmap.diff.toFixed(2);
							const pp = score.pp.toFixed(2);
							const accuracy = (Math.round(score.acc * 100) / 100).toFixed(2);
							const scoreMods = getEnabledMods(score.mods);
							const scoreFormatted = score.score.toLocaleString();
							const scoreDate = score.play_time;
							const scoreDateUnix = Date.parse(scoreDate) / 1000;

							let rankingEmote;

							switch (score.grade) {
							case 'XH':
								rankingEmote = '<:rankXH:1140241188595703830>';
								break;
							case 'X':
								rankingEmote = '<:rankX:1140241185059913830>';
								break;
							case 'SH':
								rankingEmote = '<:rankSH:1140241183357014087>';
								break;
							case 'S':
								rankingEmote = '<:rankS:1140241180089647114>';
								break;
							case 'A':
								rankingEmote = '<:rankA:1140241164650426451>';
								break;
							case 'B':
								rankingEmote = '<:rankB:1140241166571421738>';
								break;
							case 'C':
								rankingEmote = '<:rankC:1140241170711187546>';
								break;
							case 'D':
								rankingEmote = '<:rankD:1140241174007906304>';
								break;
							case 'F':
								rankingEmote = '<:rankF:1140241177136861198>';
								break;
							default:
								rankingEmote = 'NoRank';
								break;
							}

							bestScores += `**${index}) [${score.beatmap.title} [${score.beatmap.version
							}]](https://osu.ppy.sh/b/${score.beatmap.id
							}) +${scoreMods}** [${starDifficulty}★]\n▸ ${rankingEmote
							} ▸ **${pp}PP** ▸ ${accuracy}%\n▸ ${scoreFormatted} ▸ x${score.max_combo
							}/${score.beatmap.max_combo} ▸ [${score.n300 + score.ngeki}/${score.n100 + score.nkatu
							}/${score.n50}/${score.nmiss
							}]\n▸ Score Set  <t:${scoreDateUnix}:R>\n`;

							index++;
						}

						bestScores = bestScores.trim();

						// Embed Here

						const scoreEmbed = new EmbedBuilder()
							.setColor(0xc70770)
							.setAuthor({
								name: `Top ${modeSelection.embedDialog} Plays for ${scoreData.player.name}:`,
							})
							.setThumbnail(`https://a.infecta.xyz/${scoreData.player.id}`)
							.setDescription(`${bestScores}`)
							.setFooter({ text: 'On Infecta\'s osu! Server' });

						await interaction.reply({ embeds: [scoreEmbed] });
					}
					catch (err) {
						interaction.reply({
							content:
								'If you\'re seeing this, something went extremely wrong in the backend lol',
							ephemeral: true,
						});
						console.error(err);
					}
				});
			});
		}
	},
};

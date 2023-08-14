const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');
const { getEnabledMods } = require('../../commands_modules/modBitwiseCalc.js');
const { modeSelector } = require('../../commands_modules/modeSelector.js');

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
		async function queryScore(playerID) {
			const queryInfo = await fetch(
				`${apiEndpoint}/v1/get_player_scores?id=${playerID}&mode=${modeSelection.selectedMode}&scope=recent&limit=1`,
			);
			const queryRes = await queryInfo.json();
			const scoreProperties = queryRes;

			return scoreProperties;
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

							let rankingEmote;

							switch (scoreInfo.grade) {
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
										rankingEmote
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
								content: `**Recent ${modeSelection.embedDialog} Play for ${playerInfo.name}:**`,
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
						content: 'It seems like you haven\'t binded your osu account to your Discord yet. Do so with **/osu-bind**',
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

						let rankingEmote;

						switch (scoreInfo.grade) {
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
									rankingEmote
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
							content: `**Recent ${modeSelection.embedDialog} Play for ${playerInfo.name}:**`,
							embeds: [scoreEmbed],
						});
					}
					catch (err) {
						console.log(err);
						interaction.reply({
							content: 'Something went wrong (Either API is down or you misspelled the username)\n (Or player has no recent scores)',
							ephemeral: true,
						});
					}
				});
			});
		}
	},
};
